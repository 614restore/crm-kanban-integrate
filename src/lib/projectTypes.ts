// Preset contact project types. Anything else is a custom type the user typed in.
export const PROJECT_TYPE_GROUPS: { label: string; types: string[] }[] = [
  {
    label: 'Exterior',
    types: [
      'Roofing',
      'Roof Inspection',
      'Roof Repair',
      'Full Roof Replacement',
      'Gutters',
      'Gutter Installation',
      'Siding',
      'Windows',
      'Full Exterior',
    ],
  },
  {
    label: 'Interior',
    types: [
      'Interior',
      'Interior Remodel',
      'Kitchen Remodel',
      'Bathroom Remodel',
      'Basement Finishing',
      'Flooring',
      'Drywall & Paint',
      'Water / Fire Damage Restoration',
    ],
  },
];

const PRESETS = new Set(PROJECT_TYPE_GROUPS.flatMap((g) => g.types));

export const isPresetProjectType = (value: string | null | undefined) => !!value && PRESETS.has(value);
