"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChartPoint {
  day: string;
  users: number;
  transactions: number;
}

/** Динамика за 30 дней: новые пользователи и операции с монетами */
export function AdminCharts({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) return null;

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="text-lg">Активность за 30 дней</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="users" name="Новые пользователи" stroke="#4ade80" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="transactions" name="Операции" stroke="#f97316" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
