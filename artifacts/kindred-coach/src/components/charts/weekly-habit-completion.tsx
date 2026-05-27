import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export type WeeklyHabitDatum = {
  day: string;
  completion: number;
};

const DEFAULT_DATA: WeeklyHabitDatum[] = [
  { day: "Monday", completion: 80 },
  { day: "Tuesday", completion: 95 },
  { day: "Wednesday", completion: 70 },
  { day: "Thursday", completion: 85 },
  { day: "Friday", completion: 100 },
  { day: "Saturday", completion: 60 },
  { day: "Sunday", completion: 75 },
];

export function WeeklyHabitCompletion({
  data = DEFAULT_DATA,
}: {
  data?: WeeklyHabitDatum[];
}) {
  const average = Math.round(
    data.reduce((sum, d) => sum + d.completion, 0) / data.length,
  );

  return (
    <Card className="border-none shadow-sm bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-xl">Weekly Habit Completion</CardTitle>
        <CardDescription>
          Average this week: <span className="font-medium text-foreground">{average}%</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="day"
                tickFormatter={(d: string) => d.slice(0, 3)}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
                fontSize={12}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(v) => `${v}%`}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
                fontSize={12}
                width={48}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--popover-border))",
                  borderRadius: "0.5rem",
                  color: "hsl(var(--popover-foreground))",
                  fontSize: "0.85rem",
                }}
                formatter={(value: number) => [`${value}%`, "Completion"]}
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              />
              <Bar
                dataKey="completion"
                fill="hsl(var(--primary))"
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
