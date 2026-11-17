from django.contrib import admin
from .models import Theme, Journal, LessonPlan, NoteBook, NoteEntry

admin.site.register(Theme)
admin.site.register(Journal)
admin.site.register(LessonPlan)
admin.site.register(NoteBook)
admin.site.register(NoteEntry)
