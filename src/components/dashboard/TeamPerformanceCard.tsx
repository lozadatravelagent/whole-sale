import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { SellerPerformance } from "@/types";

interface TeamPerformanceCardProps {
  teamPerformance: SellerPerformance[];
}

export function TeamPerformanceCard({ teamPerformance }: TeamPerformanceCardProps) {
  if (!teamPerformance || teamPerformance.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance del Equipo</CardTitle>
          <CardDescription>No hay vendedores asignados aún</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Sort by revenue descending
  const sortedTeam = [...teamPerformance].sort((a, b) => b.revenue - a.revenue);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance del Equipo</CardTitle>
        <CardDescription>Comparativa de vendedores</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Ganados</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Conversión</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTeam.map((seller) => (
              <TableRow key={seller.seller_id}>
                <TableCell className="font-medium">{seller.seller_name}</TableCell>
                <TableCell className="text-right">{seller.leads_count}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={seller.won_count > 0 ? "default" : "secondary"}>
                    {seller.won_count}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  ${seller.revenue.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant={
                      seller.conversion_rate >= 30
                        ? "default"
                        : seller.conversion_rate >= 20
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {seller.conversion_rate.toFixed(1)}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
