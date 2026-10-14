import "./_refined.css";
import RefinedHome from "./_refined/Home";
import { RefinedHeader } from "./_refined/Header";

export function Refined() {
  return (
    <div className="qr-social-refined min-h-screen bg-background text-foreground">
      <RefinedHeader />
      <RefinedHome />
    </div>
  );
}

export default Refined;
