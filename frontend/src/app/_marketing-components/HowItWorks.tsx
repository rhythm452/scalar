const inlineLinks = [
  "Domain Name System (DNS)",
  "domain name registration",
  "health-checking",
];

export function HowItWorks() {
  return (
    <section className="bg-gray-50 py-20">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-6 lg:grid-cols-2 lg:gap-16">
        <div
          className="min-h-[280px] rounded-2xl bg-cover bg-center lg:min-h-[380px]"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=70)",
          }}
          role="img"
          aria-label="Network infrastructure illustration"
        />

        <div>
          <h2 className="mb-6 text-3xl font-bold tracking-tight text-navy">How it works</h2>
          <p className="mb-4 text-sm leading-relaxed text-text-muted">
            Amazon Route 53 provides highly available and scalable{" "}
            <a href="#" className="text-accent-blue underline hover:no-underline">
              {inlineLinks[0]}
            </a>
            ,{" "}
            <a href="#" className="text-accent-blue underline hover:no-underline">
              {inlineLinks[1]}
            </a>
            , and{" "}
            <a href="#" className="text-accent-blue underline hover:no-underline">
              {inlineLinks[2]}
            </a>{" "}
            cloud services. It is designed to give developers and businesses an extremely
            reliable and cost-effective way to route end users to internet applications by
            translating names like example.com into the numeric IP addresses, such as
            192.0.2.1, that computers use to connect to each other. You can combine your
            Route 53 DNS with health-checking services to route traffic to healthy endpoints
            or to independently monitor and alarm on endpoints. You can also use the{" "}
            <a href="#" className="text-accent-blue underline hover:no-underline">
              Traffic Flow
            </a>{" "}
            visual policy builder to simplify the implementation of your routing policies, and
            you can purchase and manage domain names such as example.com and automatically
            configure DNS settings for your domains.
          </p>
          <p className="text-sm leading-relaxed text-text-muted">
            In addition,{" "}
            <a href="#" className="text-accent-blue underline hover:no-underline">
              Route 53 Resolver
            </a>{" "}
            provides a regional DNS service that performs recursive DNS lookups for names
            hosted in Amazon Elastic Compute Cloud (EC2), as well as public names on the
            internet. Lastly, the{" "}
            <a href="#" className="text-accent-blue underline hover:no-underline">
              Route 53 Resolver DNS Firewall
            </a>{" "}
            allows you to block queries made for known or suspected malicious domains, and
            allow queries for trusted domains when using the Route 53 Resolver for recursive
            DNS resolution.
          </p>
        </div>
      </div>
    </section>
  );
}
