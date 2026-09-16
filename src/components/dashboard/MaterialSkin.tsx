import { useMemo, useRef } from 'react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import type { DashboardUI, SkinProps } from './ui'

const materialUI: DashboardUI = {
  Button: (props) => <Button {...props} size="small" variant="outlined" />,
  Select: ({ label, value, options, onChange }) => (
    <FormControl size="small" className="dash-material-select">
      <InputLabel>{label}</InputLabel>
      <Select
        label={label}
        value={value}
        inputProps={{ 'aria-label': label }}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  ),
  Panel: (props) => (
    <Paper
      {...props}
      variant="outlined"
      className={`dash-panel ${props.className ?? ''}`}
    />
  ),
  Table: (props) => <Table {...props} size="small" />,
  Head: (props) => <TableHead {...props} />,
  Body: (props) => <TableBody {...props} />,
  Row: (props) => <TableRow {...props} />,
  Cell: ({ heading, ...props }) => (
    <TableCell {...props} component={heading ? 'th' : 'td'} />
  ),
}
export default function MaterialSkin({ children, appearance }: SkinProps) {
  const portal = useRef<HTMLDivElement>(null)
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: appearance,
          primary: { main: appearance === 'dark' ? '#a5b4fc' : '#6366f1' },
          background: { paper: appearance === 'dark' ? '#1c1d23' : '#ffffff' },
        },
        typography: {
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          fontSize: 13,
          button: { textTransform: 'none' },
        },
        shape: { borderRadius: 8 },
        components: {
          MuiPopover: { defaultProps: { container: () => portal.current } },
        },
      }),
    [appearance],
  )
  return (
    <ThemeProvider theme={theme}>
      <div ref={portal} className="dash-portal" />
      {children(materialUI)}
    </ThemeProvider>
  )
}
