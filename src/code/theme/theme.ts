import { createTheme } from '@mui/material/styles';

// Central Material-UI theme definition
const appTheme = createTheme({
  palette: {
    primary: {
      main: '#003566',
      light: '#001d3d',
      dark: '#000814',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#ffc300',
      light: '#ffd60a',
      dark: '#e5ae00',
      contrastText: '#000000',
    },
    background: {
      default: '#000814',
      paper: '#001d3d',
    },
    text: {
      primary: '#ffffff',
      secondary: '#ffc300',
    },
    divider: '#003566',
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h2: {
      color: '#ffc300',
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 4,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#001d3d',
          backgroundImage: 'none',
        },
      },
    },
  },
});

export default appTheme;
