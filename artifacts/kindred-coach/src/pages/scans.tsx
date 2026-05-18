import { useCreateBodyScan, useListBodyScans, getListBodyScansQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ScanLine, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";

const FEELINGS = [
  "Calm", "Anxious", "Focused", "Scattered", "Grounded", "Overwhelmed",
  "Hopeful", "Tired", "Restless", "Content", "Irritable", "Energized",
  "Sad", "Grateful", "Numb", "Present", "Disconnected", "Peaceful",
  "Tense", "Light", "Heavy", "Clear",
];

export default function Scans() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: scans, isLoading } = useListBodyScans({ query: { queryKey: getListBodyScansQueryKey() } });
  const createScan = useCreateBodyScan();

  const [selectedFeelings, setSelectedFeelings] = useState<string[]>([]);
  const [energyLevel, setEnergyLevel] = useState(5);
  const [physicalSensations, setPhysicalSensations] = useState("");
  const [notes, setNotes] = useState("");

  const toggleFeeling = (feeling: string) => {
    setSelectedFeelings((prev) =>
      prev.includes(feeling) ? prev.filter((f) => f !== feeling) : [...prev, feeling]
    );
  };

  const handleSubmit = () => {
    if (selectedFeelings.length === 0) {
      toast({ title: "Select at least one feeling", variant: "destructive" });
      return;
    }
    createScan.mutate(
      {
        data: {
          feelings: selectedFeelings,
          energyLevel,
          physicalSensations: physicalSensations || undefined,
          notes: notes || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Body scan logged", description: "Check-in recorded." });
          queryClient.invalidateQueries({ queryKey: getListBodyScansQueryKey() });
          setSelectedFeelings([]);
          setEnergyLevel(5);
          setPhysicalSensations("");
          setNotes("");
        },
      }
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <header className="space-y-2 pt-4">
        <h1 className="text-3xl font-serif text-foreground tracking-tight flex items-center gap-3">
          <ScanLine className="w-8 h-8 text-primary" />
          Body Scan
        </h1>
        <p className="text-muted-foreground text-lg">Pause and notice what's happening right now.</p>
      </header>

      <Card className="border-border shadow-sm">
        <CardContent className="p-6 space-y-7">
          <div className="space-y-3">
            <Label className="text-base font-medium">What are you feeling right now?</Label>
            <p className="text-sm text-muted-foreground">Select all that apply.</p>
            <div className="flex flex-wrap gap-2">
              {FEELINGS.map((feeling) => {
                const active = selectedFeelings.includes(feeling);
                return (
                  <button
                    key={feeling}
                    onClick={() => toggleFeeling(feeling)}
                    data-testid={`feeling-${feeling.toLowerCase()}`}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 border",
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                        : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-primary/5"
                    )}
                  >
                    {feeling}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-base font-medium">Energy Level: {energyLevel} / 10</Label>
            <Slider
              value={[energyLevel]}
              onValueChange={([v]) => setEnergyLevel(v)}
              min={1}
              max={10}
              step={1}
              className="w-full"
              data-testid="slider-energy"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Depleted</span>
              <span>Vibrant</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-base font-medium">Physical sensations (optional)</Label>
            <Textarea
              placeholder="E.g., tight chest, restless legs, heavy eyelids..."
              className="resize-none bg-background min-h-[80px]"
              value={physicalSensations}
              onChange={(e) => setPhysicalSensations(e.target.value)}
              data-testid="textarea-physical"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-base font-medium">Any additional notes? (optional)</Label>
            <Textarea
              placeholder="What triggered this check-in? Anything you want to remember?"
              className="resize-none bg-background min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="textarea-notes"
            />
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleSubmit}
        disabled={createScan.isPending}
        className="w-full h-14 text-lg font-medium shadow-md"
        data-testid="button-log-scan"
      >
        {createScan.isPending ? "Saving..." : "Log This Scan"}
      </Button>

      {!isLoading && scans && scans.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-foreground flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted-foreground" />
            Recent Scans
          </h2>
          <div className="space-y-3">
            {scans.slice(0, 5).map((scan) => (
              <Card key={scan.id} className="border-border shadow-none" data-testid={`card-scan-${scan.id}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {format(parseISO(scan.scannedAt), "MMM d, h:mm a")}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      Energy {scan.energyLevel}/10
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {scan.feelings.map((f) => (
                      <span
                        key={f}
                        className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
