import { Plus } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-slate-100 bg-white">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-5 py-8 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
            <Plus className="h-4 w-4 text-white" strokeWidth={3} />
          </span>
          <span className="text-[18px] font-extrabold tracking-tight">
            <span className="text-navy">Med</span>
            <span className="text-brand">Easy</span>
          </span>
        </div>
        <p className="max-w-xl text-sm text-muted">
          Price comparisons are informational and based on the loaded catalogue. They are not medical advice or a recommendation to switch treatment.
        </p>
        <div className="flex gap-5 text-sm font-medium text-slate-500">
          <Link to="/data-sources" className="hover:text-navy">Data Sources</Link>
          <Link to="/help" className="hover:text-navy">Help</Link>
        </div>
      </div>
    </footer>
  );
}
