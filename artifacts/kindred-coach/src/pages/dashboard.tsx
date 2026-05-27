import { useGetTodaySummary, useGetStreaks, useGetMoodTrend, getGetTodaySummaryQueryKey, getGetStreaksQueryKey, getGetMoodTrendQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sunrise, Sunset, Flame, Activity } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { WeeklyHabitCompletion } from "@/components/charts/weekly-habit-completion";
import { PositiveAffirmations } from "@/components/dashboard/positive-affirmations";
import { CalendarEvents } from "@/components/dashboard/calendar-events";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetTodaySummary({ query: { queryKey: getGetTodaySummaryQueryKey() } });
  const { data: streaks, isLoading: isLoadingStreaks } = useGetStreaks({ query: { queryKey: getGetStreaksQueryKey() } });
  const { data: moodTrend, isLoading: isLoadingMood } = useGetMoodTrend({ query: { queryKey: getGetMoodTrendQueryKey() } });

  const isClear = summary?.currentMentalLoad === "clear";
  
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
      <header className="space-y-2 pt-4">
        <h1 className="text-3xl font-serif text-foreground tracking-tight">Today</h1>
        <p className="text-muted-foreground text-lg">
          {summary?.currentMentalLoad ? `Your mind feels ${summary.currentMentalLoad} right now.` : "Take a moment to check in."}
        </p>
      </header>

      <PositiveAffirmations />

      <CalendarEvents />

      <WeeklyHabitCompletion />

      <div className="grid grid-cols-2 gap-4">
        {isLoadingSummary ? (
          <>
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </>
        ) : (
          <>
            <Card className="border-none shadow-sm bg-primary/5">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-3">
                <div className={`p-3 rounded-full ${summary?.morningDone ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  <Sunrise className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Morning</p>
                  <p className="text-xs text-muted-foreground">{summary?.morningDone ? 'Completed' : 'Pending'}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-secondary/5">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-3">
                <div className={`p-3 rounded-full ${summary?.eveningDone ? 'bg-secondary/20 text-secondary' : 'bg-muted text-muted-foreground'}`}>
                  <Sunset className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Evening</p>
                  <p className="text-xs text-muted-foreground">{summary?.eveningDone ? 'Completed' : 'Pending'}</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card className="border-none shadow-sm bg-card overflow-hidden relative">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> 
            Recent Mood
          </CardTitle>
          <CardDescription>Over the last 7 days</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 pb-6">
          {isLoadingMood ? (
            <Skeleton className="h-40 w-full" />
          ) : moodTrend && moodTrend.length > 0 ? (
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={moodTrend} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMood" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => format(parseISO(val), 'MMM d')}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis hide domain={[0, 10]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="medicationEffectiveness" 
                    stroke="hsl(var(--primary))" 
                    fillOpacity={1} 
                    fill="url(#colorMood)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
              Not enough data yet
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-foreground flex items-center gap-2">
            <Flame className="w-5 h-5 text-secondary" />
            Active Streaks
          </h2>
        </div>
        
        {isLoadingStreaks ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : streaks && streaks.length > 0 ? (
          <div className="space-y-3">
            {streaks.map((streak) => (
              <Card key={streak.habitId} className="border-border shadow-none">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{streak.habitName}</p>
                    <p className="text-xs text-muted-foreground">
                      Longest: {streak.longestStreak} days
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-serif text-secondary">{streak.currentStreak}</span>
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed bg-transparent shadow-none">
            <CardContent className="p-8 text-center text-muted-foreground">
              No active streaks yet. Head to Habits to start building!
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
