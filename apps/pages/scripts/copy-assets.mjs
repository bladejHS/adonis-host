// Fotografiile și logo-ul vin din aplicația admin (o singură sursă).
import { cpSync } from "node:fs";
for (const dir of ["photos", "brand"]) cpSync(new URL(`../../admin/public/${dir}`, import.meta.url), new URL(`../public/${dir}`, import.meta.url), { recursive: true });
console.log("Fotografii și logo copiate în public/");
