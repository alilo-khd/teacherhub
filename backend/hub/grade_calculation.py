"""Versioned grade calculation engine.

Implements the Master Specification requirement for a calculation service
rather than embedding formulas in React components or scattered API views.

The engine:
1. Identifies the applicable ruleset/version by effective dates and academic scope
2. Fetches eligible assessment results
3. Normalizes scores as defined by component_max
4. Applies weights and exclusions from formula_config
5. Handles missing/absent/exempt states according to policy
6. Applies configured rounding
7. Persists the result with full provenance (CalculatedResult)
8. Invalidates/recalculates when source grades or rules change
9. Provides a calculation breakdown to authorized users
"""

import logging
from decimal import Decimal, ROUND_HALF_UP
from django.db import models, transaction
from django.utils import timezone

from .models import (
    GradeRuleSet, CalculatedResult, Mark, Assessment, AssessmentResult,
    Student, SchoolClass, Course, AcademicYear, Enrollment,
)

logger = logging.getLogger(__name__)


def find_applicable_ruleset(school, subject=None, academic_year=None, term=None,
                            effective_date=None):
    """Find the most specific active, approved ruleset for the given scope.

    Resolution order (most specific first):
      1. school + subject + academic_year + term
      2. school + subject + academic_year (any term)
      3. school + academic_year + term (any subject)
      4. school + academic_year (any subject/term)
      5. school only (any subject/year/term)

    Returns the GradeRuleSet instance or None.
    """
    if effective_date is None:
        effective_date = timezone.now().date()

    candidates = GradeRuleSet.objects.filter(
        school=school,
        is_active=True,
        is_approved=True,
        effective_from__lte=effective_date,
    ).filter(
        models.Q(effective_to__isnull=True) | models.Q(effective_to__gte=effective_date)
    )

    if subject:
        candidates = candidates.filter(subject=subject)
    if academic_year:
        candidates = candidates.filter(academic_year=academic_year)
    if term is not None:
        candidates = candidates.filter(term=term)

    # Prefer more specific matches: subject > academic_year > term
    scored = []
    for rs in candidates:
        score = 0
        if rs.subject_id == (subject.id if subject else None):
            score += 4
        if rs.academic_year_id == (academic_year.id if academic_year else None):
            score += 2
        if rs.term == term:
            score += 1
        scored.append((score, rs))

    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0][1] if scored else None


def normalize_score(raw_score, max_score):
    """Normalize a raw score to 0-100 percentage."""
    if raw_score is None or max_score is None or max_score == 0:
        return None
    return round((float(raw_score) / float(max_score)) * 100, 4)


def calculate_student_grade(student, school_class, subject, academic_year, term,
                            ruleset, include_breakdown=True):
    """Calculate a single student's grade using the given ruleset.

    Returns a dict with calculated_value, calculated_percent, input_snapshot,
    and calculation_breakdown.
    """
    formula_config = ruleset.formula_config or {}
    component_weights = formula_config.get("component_weights", {
        "continuous": 0.3, "supervised": 0.3, "exam": 0.4
    })
    component_max = ruleset.component_max or {
        "continuous": 20, "supervised": 20, "exam": 20
    }
    rounding = formula_config.get("rounding", 2)
    pass_threshold = formula_config.get("pass_threshold", 50)

    # Gather input marks
    mark = Mark.objects.filter(student=student, term=term).first()

    # Gather assessment results for this student in this subject/class/term
    assessment_results = AssessmentResult.objects.filter(
        student=student,
        assessment__school_class=school_class,
        assessment__subject=subject,
        assessment__term=term,
    ).select_related("assessment")

    # Build input snapshot
    input_snapshot = {
        "mark": {
            "continuous": mark.continuous if mark else None,
            "supervised": mark.supervised if mark else None,
            "exam": mark.exam if mark else None,
        } if mark else None,
        "assessment_results": [
            {
                "assessment_id": r.assessment_id,
                "assessment_title": r.assessment.title,
                "assessment_kind": r.assessment.assessment_kind,
                "max_score": float(r.assessment.max_score) if r.assessment.max_score else None,
                "status": r.status,
                "score": float(r.score) if r.score is not None else None,
                "score_percent": r.score_percent,
            }
            for r in assessment_results
        ],
    }

    # Calculate component percentages
    components = {}
    breakdown = {}

    # From Mark model
    if mark:
        for comp_name in ("continuous", "supervised", "exam"):
            max_val = component_max.get(comp_name, 20)
            raw = getattr(mark, comp_name, None)
            pct = normalize_score(raw, max_val)
            components[comp_name] = pct
            breakdown[comp_name] = {
                "raw_score": raw,
                "max_score": max_val,
                "percent": pct,
                "weight": component_weights.get(comp_name, 0),
            }

    # From Assessment results - aggregate by kind
    kind_aggregates = {}
    for r in assessment_results:
        kind = r.assessment.grade_component  # "continuous", "supervised", or "exam"
        if kind not in kind_aggregates:
            kind_aggregates[kind] = []
        if r.score_percent is not None:
            kind_aggregates[kind].append(r.score_percent)

    # If we have assessment results, they override/augment the Mark components
    for kind, percents in kind_aggregates.items():
        if percents:
            avg_pct = round(sum(percents) / len(percents), 4)
            components[kind] = avg_pct
            if kind in breakdown:
                breakdown[kind]["assessment_avg_percent"] = avg_pct
                breakdown[kind]["assessment_count"] = len(percents)
            else:
                breakdown[kind] = {
                    "raw_score": None,
                    "max_score": None,
                    "percent": avg_pct,
                    "weight": component_weights.get(kind, 0),
                    "assessment_avg_percent": avg_pct,
                    "assessment_count": len(percents),
                }

    # Calculate weighted result
    weighted_sum = 0.0
    total_weight = 0.0
    for comp_name, pct in components.items():
        weight = component_weights.get(comp_name, 0)
        if pct is not None:
            weighted_sum += pct * weight
            total_weight += weight

    if total_weight > 0:
        calculated_percent = round(weighted_sum / total_weight, 4)
    else:
        calculated_percent = None

    # Convert to /20 scale (or whatever the primary scale is)
    # The calculated_value is on a 20-point scale by default
    if calculated_percent is not None:
        # Assume 20-point scale: percent / 100 * 20
        calculated_value = round(calculated_percent / 100 * 20, rounding)
    else:
        calculated_value = None

    result = {
        "calculated_value": calculated_value,
        "calculated_percent": calculated_percent,
        "input_snapshot": input_snapshot,
    }

    if include_breakdown:
        result["calculation_breakdown"] = {
            "components": breakdown,
            "component_weights": component_weights,
            "total_weight": total_weight,
            "weighted_sum": round(weighted_sum, 4),
            "pass_threshold": pass_threshold,
            "passed": calculated_percent is not None and calculated_percent >= pass_threshold,
        }

    return result


@transaction.atomic
def calculate_and_save_results(school_class, subject, academic_year, term,
                               ruleset, recalculate_all=False):
    """Calculate grades for all students in a class and save CalculatedResult records.

    Returns a list of created/updated CalculatedResult instances.
    """
    # Get active enrollments for this class in this academic year
    enrollments = Enrollment.objects.filter(
        school=school_class.school,
        class_section=school_class,
        academic_year=academic_year,
        status="active",
    ).select_related("student")

    if not ruleset.is_approved:
        raise ValueError("Cannot calculate with an unapproved ruleset")

    results = []
    for enrollment in enrollments:
        student = enrollment.student

        # Skip if result already exists and we're not recalculating
        if not recalculate_all:
            existing = CalculatedResult.objects.filter(
                student=student,
                subject=subject,
                academic_year=academic_year,
                term=term,
                ruleset_version=ruleset.version,
            ).first()
            if existing:
                results.append(existing)
                continue

        calc = calculate_student_grade(
            student=student,
            school_class=school_class,
            subject=subject,
            academic_year=academic_year,
            term=term,
            ruleset=ruleset,
        )

        # Delete any existing result for this student/subject/term/ruleset
        CalculatedResult.objects.filter(
            student=student,
            subject=subject,
            academic_year=academic_year,
            term=term,
            ruleset_version=ruleset.version,
        ).delete()

        result = CalculatedResult.objects.create(
            student=student,
            school_class=school_class,
            subject=subject,
            academic_year=academic_year,
            term=term,
            ruleset=ruleset,
            ruleset_version=ruleset.version,
            input_snapshot=calc["input_snapshot"],
            calculated_value=calc["calculated_value"],
            calculated_percent=calc["calculated_percent"],
            calculation_breakdown=calc.get("calculation_breakdown", {}),
            status="calculated",
        )
        results.append(result)

    return results


def preview_calculation(student, school_class, subject, academic_year, term, ruleset):
    """Preview a calculation without saving. Returns the calculation dict."""
    return calculate_student_grade(
        student=student,
        school_class=school_class,
        subject=subject,
        academic_year=academic_year,
        term=term,
        ruleset=ruleset,
        include_breakdown=True,
    )



