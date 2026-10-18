// Recalculează alertele (ritm rezervări, recenzii, stocuri, sincronizare). Rulare: pnpm --filter @adonis/api alerts
import { refreshAlerts } from "@adonis/core";
console.log(await refreshAlerts());
process.exit(0);
