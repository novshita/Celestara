/**
 * Product spec §24: beginner-friendly by default, technical detail whenever
 * wanted. "My default" sends nothing, so a logged-in visitor's saved
 * preference applies and everyone else gets beginner.
 */
export function DepthSelect() {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-300">
      Explanation
      <select name="depth" defaultValue="" className="input w-auto">
        <option value="">My default</option>
        <option value="beginner">Beginner</option>
        <option value="technical">Technical</option>
      </select>
    </label>
  );
}
