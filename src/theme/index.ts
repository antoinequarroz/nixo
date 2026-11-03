// Direction E "Grain": adult, editorial, warm dark film-grain background,
// magazine serif (Newsreader), DM Mono labels, Inter Tight body.

export const colors = {
  ground: '#141210',
  groundDead: '#0F0F0F',
  ink: '#EDE6DA',
  inkSoft: '#D9CFC0',
  inkItalic: '#CDBFA9',
  muted: '#B8AE9F',
  hairline: 'rgba(237,230,218,0.22)',
  hairlineSoft: 'rgba(237,230,218,0.10)',
  accent: '#B8673F',
  blobOxblood: '#5A2A22',
  blobTeal: '#2E4A47',
  blobOchre: '#6B4E2A',
  danger: '#C46A5A',
  deadInk: '#D8D3CC',
  deadMuted: '#9C968E',
};

export const fonts = {
  serif: 'Newsreader_300Light',
  serifItalic: 'Newsreader_300Light_Italic',
  serifRegular: 'Newsreader_400Regular',
  serifRegularItalic: 'Newsreader_400Regular_Italic',
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
  sans: 'InterTight_400Regular',
  sansMedium: 'InterTight_500Medium',
  sansSemi: 'InterTight_600SemiBold',
};

export const type = {
  label: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    color: colors.muted,
  },
  smallLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: colors.muted,
  },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.ink },
};

/** Width from which we switch to two panes (unfolded foldables, Surface Duo, tablets). */
export const WIDE_BREAKPOINT = 600;
