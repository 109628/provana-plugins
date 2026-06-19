---
name: ui-styling
description: >
  shadcn/ui component patterns, Tailwind CSS conventions, Next.js App Router layout
  patterns, dark mode implementation, responsive design. Use when building or reviewing
  UI components in Next.js projects — choosing components, styling variants, composing
  layouts, handling states, implementing dark mode.
---

# Provana UI Styling — shadcn/ui + Tailwind + Next.js

## Stack

- **Next.js 14+** — App Router
- **shadcn/ui** — component primitives (Radix UI based)
- **Tailwind CSS** — utility classes
- **`cn()` utility** — `clsx` + `tailwind-merge` for conditional classes

---

## Core Rule

> Use shadcn/ui components as primitives. Extend via `className` prop and `cn()`.
> Never modify files in `components/ui/` — copy and customize in `components/app/`.

```tsx
// components/ui/button.tsx — DON'T touch
// components/app/submit-button.tsx — DO extend here

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function SubmitButton({ loading, ...props }) {
  return (
    <Button
      {...props}
      disabled={loading || props.disabled}
      className={cn('min-w-[120px]', props.className)}
    >
      {loading ? <Spinner className="h-4 w-4" /> : props.children}
    </Button>
  )
}
```

---

## Component Selection Guide

| Need | Use |
|---|---|
| Button | `<Button>` — variants: default, secondary, outline, ghost, destructive, link |
| Icon button | `<Button size="icon">` + `aria-label` |
| Input | `<Input>` |
| Textarea | `<Textarea>` |
| Select (few options) | `<Select>` (Radix) |
| Select (many/searchable) | `<Command>` inside `<Popover>` (combobox pattern) |
| Multi-select | combobox pattern with checkboxes |
| Checkbox | `<Checkbox>` |
| Toggle/Switch | `<Switch>` |
| Date picker | `<Calendar>` inside `<Popover>` + `react-day-picker` |
| Modal/Dialog | `<Dialog>` — not custom divs |
| Slide-in panel | `<Sheet>` |
| Tooltip | `<Tooltip>` — not `title` attribute |
| Dropdown menu | `<DropdownMenu>` |
| Alert/Banner | `<Alert>` with `variant="destructive"` for errors |
| Toast/Notification | `<Sonner>` (shadcn/ui toast) |
| Data table | `<Table>` + `@tanstack/react-table` |
| Tabs | `<Tabs>` |
| Accordion | `<Accordion>` |
| Badge/Chip | `<Badge>` — variants: default, secondary, outline, destructive |
| Avatar | `<Avatar>` with `<AvatarFallback>` |
| Card | `<Card>` + `<CardHeader>` + `<CardContent>` |
| Skeleton | `<Skeleton>` — match shape of real content |
| Separator | `<Separator>` — not `<hr>` |
| Progress | `<Progress>` |

---

## Layout Patterns

### App Shell (Admin/Dashboard)
```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(fontSans.variable, 'min-h-screen bg-background font-sans antialiased')}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

// app/(dashboard)/layout.tsx
export default function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

### Page Structure
```tsx
export default function ReportsPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Call performance for the last 30 days
          </p>
        </div>
        <Button>Export CSV</Button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard ... />
      </div>

      {/* Main content */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable ... />
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## Data Table Pattern

Provana's most common UI pattern. Always use `@tanstack/react-table`.

```tsx
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, getPaginationRowModel,
  flexRender, ColumnDef, SortingState
} from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// Column definition
const columns: ColumnDef<AgentRecord>[] = [
  {
    accessorKey: 'agentName',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting()}>
        Agent
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: 'callsHandled',
    header: 'Calls',
    cell: ({ row }) => (
      <span className="tabular-nums text-right block">
        {row.getValue('callsHandled').toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.getValue('status')} />,
  },
]

// Table component
function DataTable({ data, columns }) {
  const [sorting, setSorting] = React.useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  })

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id} className="bg-muted/50">
                {hg.headers.map(header => (
                  <TableHead key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row, i) => (
                <TableRow
                  key={row.id}
                  className={cn(i % 2 === 0 && 'bg-muted/30')}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <TablePagination table={table} />
    </div>
  )
}
```

---

## Status Badge Pattern

```tsx
const statusConfig = {
  active:   { label: 'Active',   className: 'bg-green-50 text-green-700 border-green-200',  icon: CheckCircle },
  inactive: { label: 'Inactive', className: 'bg-gray-50 text-gray-600 border-gray-200',    icon: MinusCircle },
  warning:  { label: 'Warning',  className: 'bg-amber-50 text-amber-700 border-amber-200',  icon: AlertTriangle },
  error:    { label: 'Error',    className: 'bg-red-50 text-red-700 border-red-200',        icon: XCircle },
  dnc:      { label: 'DNC',      className: 'bg-red-600 text-white border-red-700',         icon: Ban },
} as const

export function StatusBadge({ status }: { status: keyof typeof statusConfig }) {
  const config = statusConfig[status]
  const Icon = config.icon
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
      config.className
    )}>
      <Icon className="h-3 w-3" aria-hidden />
      {config.label}
    </span>
  )
}
```

---

## Dark Mode Implementation

```tsx
// components/theme-provider.tsx
import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children, ...props }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

// components/theme-toggle.tsx
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
```

---

## Form Pattern (react-hook-form + zod)

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'

const schema = z.object({
  agentName: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  email: z.string().email('Invalid email address'),
})

export function AgentForm({ onSubmit }) {
  const form = useForm({ resolver: zodResolver(schema) })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="agentName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Agent Name <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input placeholder="John Smith" {...field} />
              </FormControl>
              <FormMessage />  {/* shows zod error */}
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : 'Save Agent'}
        </Button>
      </form>
    </Form>
  )
}
```

---

## Responsive Utilities Quick Reference

```tsx
// Grid: 1 col mobile → 2 tablet → 4 desktop
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

// Show/hide
<div className="hidden md:block">   {/* desktop only */}
<div className="md:hidden">         {/* mobile only */}

// Sidebar layout (hidden on mobile)
<aside className="hidden w-60 shrink-0 border-r lg:block">

// Responsive text
<h1 className="text-xl md:text-2xl lg:text-3xl font-semibold">

// Responsive padding
<div className="p-4 md:p-6 lg:p-8">

// Stack → row
<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
```

---

## Common Anti-Patterns

```tsx
// ❌ Raw div for dialog
<div className="fixed inset-0 z-50 bg-black/50">
// ✅ Use shadcn Dialog
<Dialog>

// ❌ Native alert()
alert('Saved!')
// ✅ Use toast
toast.success('Agent saved successfully')

// ❌ title attribute for tooltip
<button title="Delete record">
// ✅ Use Tooltip component
<Tooltip><TooltipTrigger>...<TooltipContent>Delete record</TooltipContent></Tooltip>

// ❌ onClick on div
<div onClick={handleClick}>
// ✅ Semantic button
<button onClick={handleClick}>

// ❌ Hardcoded color
<p style={{ color: '#6b7280' }}>
// ✅ Semantic token
<p className="text-muted-foreground">

// ❌ Skipping loading state
const data = await fetch(...)
// ✅ Always handle loading
const [loading, setLoading] = useState(true)
```
