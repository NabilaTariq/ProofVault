export function Stamp({ paid }: { paid: boolean }) {
  return (
    <span className={`stamp-mark ${paid ? "border-wine-950 bg-wine-950 text-cream-50" : "border-taupe-200 bg-cream-50 text-ember-700"}`}>
      {paid ? "Paid" : "Awaiting payment"}
    </span>
  );
}
