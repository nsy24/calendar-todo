"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CalendarProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  className?: string;
}

export function Calendar({ selectedDate, onDateSelect, className }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // 月の最初の日の曜日を取得（0=日曜日）
  const firstDayOfWeek = monthStart.getDay();
  
  // 前月の最後の数日を取得
  const prevMonthDays: Date[] = [];
  if (firstDayOfWeek > 0) {
    const prevMonthEnd = new Date(monthStart);
    prevMonthEnd.setDate(0);
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      prevMonthDays.push(new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), prevMonthEnd.getDate() - i));
    }
  }

  // 次月の最初の数日を取得（カレンダーを埋めるため）
  const totalCells = prevMonthDays.length + daysInMonth.length;
  const nextMonthDays: Date[] = [];
  const remainingCells = 42 - totalCells; // 6週間分
  if (remainingCells > 0) {
    const nextMonthStart = new Date(monthEnd);
    nextMonthStart.setDate(monthEnd.getDate() + 1);
    for (let i = 0; i < remainingCells; i++) {
      nextMonthDays.push(new Date(nextMonthStart.getFullYear(), nextMonthStart.getMonth(), nextMonthStart.getDate() + i));
    }
  }

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDateClick = (date: Date) => {
    if (onDateSelect) {
      onDateSelect(date);
    }
  };

  const weekDays = ["日", "月", "火", "水", "木", "金", "土"];

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevMonth}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">
          {format(currentMonth, "yyyy年M月")}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextMonth}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}
        {prevMonthDays.map((date) => (
          <div
            key={date.toISOString()}
            className="aspect-square text-center text-sm text-muted-foreground/50 flex items-center justify-center"
          >
            {format(date, "d")}
          </div>
        ))}
        {daysInMonth.map((date) => {
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          const isToday = isSameDay(date, new Date());
          return (
            <button
              key={date.toISOString()}
              onClick={() => handleDateClick(date)}
              className={cn(
                "aspect-square text-center text-sm flex items-center justify-center rounded-md transition-colors hover:bg-accent",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                !isSelected && isToday && "bg-accent font-semibold",
                !isSelected && !isToday && "hover:bg-accent"
              )}
            >
              {format(date, "d")}
            </button>
          );
        })}
        {nextMonthDays.map((date) => (
          <div
            key={date.toISOString()}
            className="aspect-square text-center text-sm text-muted-foreground/50 flex items-center justify-center"
          >
            {format(date, "d")}
          </div>
        ))}
      </div>
    </div>
  );
}
