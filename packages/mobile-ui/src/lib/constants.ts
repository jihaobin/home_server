import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

export const THEME = {
    light: {
      background: 'hsl(0 0% 100%)', // background
        border: 'hsl(214.2857 31.8182% 91.3725%)', // border
      card: 'hsl(0 0% 100%)', // card
        notification: 'hsl(0 84.2365% 60.1961%)', // destructive
        primary: 'hsl(142.1277 76.2162% 36.2745%)', // primary
        text: 'hsl(222.2222 47.3684% 11.1765%)', // foreground
    },
    dark: {
        background: 'hsl(222.8571 84% 4.902%)', // background
        border: 'hsl(217.2414 32.5843% 17.451%)', // border
        card: 'hsl(222.8571 53.8462% 7.6471%)', // card
        notification: 'hsl(0 62.8205% 30.5882%)', // destructive
        primary: 'hsl(142.0859 70.5628% 45.2941%)', // primary
        text: 'hsl(210 40% 98.0392%)', // foreground
    },
  };

  export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.notification,
      primary: THEME.light.primary,
      text: THEME.light.text,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.notification,
      primary: THEME.dark.primary,
      text: THEME.dark.text,
    },
  },
};