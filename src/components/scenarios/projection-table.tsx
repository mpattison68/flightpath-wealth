import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ProjectionOutput } from "@/lib/finance/projection";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ProjectionTable({
  projection, invCcy, tgtCcy,
}: { projection: ProjectionOutput; invCcy: string; tgtCcy: string }) {
  return (
    <ScrollArea className="h-[480px] rounded-md border">
      <Table>
        <TableHeader className="sticky top-0 bg-card">
          <TableRow>
            <TableHead>Year</TableHead>
            <TableHead>Age</TableHead>
            <TableHead className="text-right">Portfolio ({invCcy})</TableHead>
            <TableHead className="text-right">Property ({invCcy})</TableHead>
            <TableHead className="text-right">Total ({invCcy})</TableHead>
            <TableHead className="text-right">Return</TableHead>
            <TableHead className="text-right">Withdraw ({invCcy})</TableHead>
            <TableHead className="text-right">Other Inc. ({invCcy})</TableHead>
            <TableHead className="text-right">Spend ({tgtCcy})</TableHead>
            <TableHead className="text-right">RPPI</TableHead>
            <TableHead className="text-right">Legacy ({tgtCcy})</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projection.years.map((y) => (
            <TableRow key={y.year} className={cn(y.isRetired && "bg-muted/30", y.underPressure && "bg-status-warning/10")}>
              <TableCell>{y.year}</TableCell>
              <TableCell>{y.age}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(y.portfolioEnd, invCcy)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(y.property, invCcy)}</TableCell>
              <TableCell className="text-right tabular-nums font-medium">{formatCurrency(y.totalWealth, invCcy)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(y.returnPct, 1)}%</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(y.portfolioWithdrawalInv, invCcy)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(y.statePension + y.consulting + y.privatePension, invCcy)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(y.spendingTgt, tgtCcy)}</TableCell>
              <TableCell className="text-right tabular-nums">{y.purchasingPowerIndex.toFixed(2)}×</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(y.legacyTgt, tgtCcy)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}