import { Accordion, type AccordionRow } from "./Accordion";

const rows: AccordionRow[] = [
  {
    id: "manage-traffic",
    title: "Manage network traffic globally",
    body: "Use latency-based, geolocation, and weighted routing policies together with health checks to send end users to the endpoint that gives them the best experience.",
  },
  {
    id: "highly-available",
    title: "Build highly available applications",
    body: "Combine Route 53 health checks with failover routing to detect an unhealthy endpoint and reroute traffic automatically, without any manual intervention.",
  },
  {
    id: "private-dns",
    title: "Set up private DNS",
    body: "Manage custom domain names for your internal AWS resources without exposing DNS data to the public Internet, using private hosted zones scoped to one or more VPCs.",
  },
];

export function UseCases() {
  return (
    <section className="mx-auto max-w-[1280px] px-6 py-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,320px)_1fr] lg:gap-16">
        <h2 className="text-3xl font-bold tracking-tight text-navy">Use cases</h2>
        <Accordion rows={rows} defaultOpenId="manage-traffic" />
      </div>
    </section>
  );
}
