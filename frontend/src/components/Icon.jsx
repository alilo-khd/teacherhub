const PATHS = {
  grid: (<><rect x="3.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.8" /></>),
  calendar: (<><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.8h17M8 3v4M16 3v4" /></>),
  users: (<><circle cx="9" cy="8.2" r="3.4" /><path d="M3.8 19.4c.7-3 2.7-4.5 5.2-4.5s4.5 1.5 5.2 4.5M15.8 5.2a3.4 3.4 0 0 1 0 6.5M17.8 15.2c1.4.6 2.2 1.9 2.6 3.7" /></>),
  bell: (<><path d="M6.5 16.5v-4.8a5.5 5.5 0 0 1 11 0v4.8l1.6 2.5H4.9Z" /><path d="M10.4 21a2.2 2.2 0 0 0 3.2 0" /><path d="M12 3.8v1.4" /></>),
  chart: (<><path d="M4 4v15.5h16" /><path d="M8 15.5v-4.2M12 15.5V8M16 15.5v-6M20 15.5V5.8" /></>),
  book: (<><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.7A1.7 1.7 0 0 0 5 19.7Z" /><path d="M5 17.8A1.7 1.7 0 0 1 6.7 16.2H19V21H6.5A1.5 1.5 0 0 1 5 19.5Z" /></>),
  layers: (<><path d="m12 3 9 5-9 5-9-5Z" /><path d="m3.6 12.7 8.4 4.7 8.4-4.7M3.6 16.7 12 21.4l8.4-4.7" /></>),
  notebook: (<><path d="M7 3.5h12.5v17H7z" /><path d="M7 3.5A2.5 2.5 0 0 0 4.5 6v14.5H19.5" /><path d="M4.5 8h2.5M4.5 12h2.5M4.5 16h2.5" /></>),
  pen: (<><path d="M4 20h4.5L19 9.5a2.1 2.1 0 0 0-3-3L5.5 17Z" /><path d="m13.8 8.2 2.5 2.5" /></>),
  sun: (<><circle cx="12" cy="12" r="3.6" /><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" /></>),
  search: (<><circle cx="10.8" cy="10.8" r="6.3" /><path d="m15.5 15.5 4.7 4.7" /></>),
  id: (<><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="8.4" cy="11" r="2.1" /><path d="M5.7 16.6c.5-1.5 1.4-2.2 2.7-2.2s2.2.7 2.7 2.2M14 9.2h4.5M14 12.4h4.5M14 15.6h2.8" /></>),
  printer: (<><path d="M7 8V3.8h10V8" /><rect x="4" y="8" width="16" height="8.5" rx="2" /><path d="M7 13.5h10v7H7z" /></>),
  palette: (<><path d="M12 21a9 9 0 1 1 9-9c0 2-1.6 3-3.2 3H15a2.3 2.3 0 0 0-1.7 4c.4.5.3 2-1.3 2Z" /><circle cx="7.5" cy="11" r="1" fill="currentColor" /><circle cx="11" cy="7.5" r="1" fill="currentColor" /><circle cx="15.5" cy="9" r="1" fill="currentColor" /></>),
  plus: (<path d="M12 5v14M5 12h14" />),
  logout: (<><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>),
  download: (<><path d="M12 4v10.5M7.5 10.8 12 15.3l4.5-4.5M4.5 19.5h15" /></>),
  upload: (<><path d="M12 14.5V4M7.5 8.2 12 3.7l4.5 4.5M4.5 19.5h15" /></>),
  file: (<><path d="M6 3.5h8L19 8.5v12H6z" /><path d="M13.5 3.5v5.5H19" /></>),
  school: (<><path d="m12 4 9 4.5-9 4.5-9-4.5Z" /><path d="M6.5 10.8v5C8.4 17.4 10.1 18 12 18s3.6-.6 5.5-2.2v-5M21 9v5" /></>),
  clipboard: (<><rect x="5" y="4.5" width="14" height="17" rx="2.5" /><path d="M9 4.5a3 3 0 0 1 6 0M9 11h6M9 15h6" /></>),
  check: (<path d="m5 12.5 4.5 4.5L19 7.5" />),
  clock: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>),
  sparkle: (<><path d="M12 3.5 13.8 10 20.5 12 13.8 14 12 20.5 10.2 14 3.5 12 10.2 10Z" /><path d="M18.8 3.8v3M17.3 5.3h3" /></>),
};

export default function Icon({ name, size = 20, className = "" }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name] || PATHS.file}
    </svg>
  );
}
