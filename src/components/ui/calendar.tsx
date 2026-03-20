'use client'

import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import { cn } from '@/lib/utils'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
        month: 'space-y-4',
        month_caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm font-medium',
        nav: 'space-x-1 flex items-center',
        button_previous: 'absolute left-1 inline-flex items-center justify-center rounded-md p-1 hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none',
        button_next: 'absolute right-1 inline-flex items-center justify-center rounded-md p-1 hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none',
        month_grid: 'w-full border-collapse space-y-1',
        weekdays: 'flex',
        weekday: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]',
        week: 'flex w-full mt-2',
        day: 'relative p-0 text-center text-sm focus-within:rounded-lg focus-within:ring-1 focus-within:ring-offset-1',
        day_button: 'h-9 w-9 p-0 font-normal aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:font-normal',
        range_end: 'rounded-r-md',
        range_middle: 'rounded-md',
        selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        today: 'bg-accent text-accent-foreground',
        outside: 'text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30',
        disabled: 'text-muted-foreground opacity-50',
        hidden: 'invisible',
        ...classNames,
      }}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
