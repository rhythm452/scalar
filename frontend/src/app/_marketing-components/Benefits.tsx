import { Accordion, type AccordionRow } from "./Accordion";

const rows: AccordionRow[] = [
  {
    id: "reliable",
    title:
      "Route end users to your site reliably with globally-dispersed Domain Name System (DNS) servers and automatic scaling.",
    body: "Route 53 is built on AWS's highly available and reliable global infrastructure, backed by a 100% availability SLA, and effectively scales to handle large, unpredictable query volumes without any intervention.",
  },
  {
    id: "fast-setup",
    title:
      "Set up your DNS routing in minutes with domain name registration and straightforward visual traffic flow tools.",
    body: "Search for and register a new domain name, or transfer an existing one, directly from the Route 53 console, then use the visual traffic flow editor to build routing policies without writing any code.",
  },
  {
    id: "custom-policies",
    title:
      "Customize your DNS routing policies to reduce latency, improve application availability, and maintain compliance.",
    body: "Choose from simple, weighted, latency, failover, and geolocation routing policies, and combine Route 53 health checks with automated DNS failover so traffic only reaches healthy endpoints.",
  },
];

export function Benefits() {
  return (
    <section className="mx-auto max-w-[1280px] px-6 py-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,320px)_1fr] lg:gap-16">
        <h2 className="text-3xl font-bold tracking-tight text-navy">Benefits of Route 53</h2>
        <Accordion rows={rows} />
      </div>
    </section>
  );
}
