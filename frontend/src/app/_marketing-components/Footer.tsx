import { ArrowUp, ChevronDown, Mail } from "lucide-react";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  PodcastIcon,
  TwitchIcon,
  XIcon,
  YoutubeIcon,
} from "./SocialIcons";

const columns: { title: string; links: string[] }[] = [
  {
    title: "Learn",
    links: [
      "What Is AWS?",
      "What Is Cloud Computing?",
      "What Is Agentic AI?",
      "Cloud Computing Concepts Hub",
      "AWS Cloud Security",
      "What's New",
      "Blogs",
      "Press Releases",
    ],
  },
  {
    title: "Resources",
    links: [
      "Getting Started",
      "Training",
      "AWS Trust Center",
      "AWS Solutions Library",
      "Architecture Center",
      "Product and Technical FAQs",
      "Analyst Reports",
      "AWS Partners",
    ],
  },
  {
    title: "Developers",
    links: [
      "Builder Center",
      "SDKs & Tools",
      ".NET on AWS",
      "Python on AWS",
      "Java on AWS",
      "PHP on AWS",
      "JavaScript on AWS",
    ],
  },
  {
    title: "Help",
    links: [
      "Contact Us",
      "File a Support Ticket",
      "AWS re:Post",
      "Knowledge Center",
      "AWS Support Overview",
      "AWS Accessibility",
      "Legal",
    ],
  },
];

const socialIcons = [
  XIcon,
  FacebookIcon,
  LinkedInIcon,
  InstagramIcon,
  TwitchIcon,
  YoutubeIcon,
  PodcastIcon,
  Mail,
];

export function Footer() {
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto max-w-[1280px] px-6 py-10">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <button className="rounded border border-white px-5 py-2.5 text-sm font-medium hover:bg-white hover:text-ink">
            Create an AWS account
          </button>
          <button className="flex items-center gap-1 rounded border border-white/40 px-4 py-2 text-sm hover:border-white">
            English
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-8 border-t border-white/10 pt-10 sm:grid-cols-4">
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-sm font-semibold text-white/60">{col.title}</h4>
              <ul className="space-y-3 text-sm">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-white/90 hover:underline">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-white/10 pt-6">
          <a href="#top" className="inline-flex items-center gap-2 text-sm hover:underline">
            Back to top
            <ArrowUp className="h-4 w-4" />
          </a>
        </div>

        <div className="mt-6 flex flex-wrap gap-4 border-t border-white/10 pt-6">
          {socialIcons.map((Icon, i) => (
            <a
              key={i}
              href="#"
              aria-label="Social link"
              className="rounded-full border border-white/30 p-2 hover:border-white"
            >
              <Icon className="h-4 w-4" />
            </a>
          ))}
        </div>

        <p className="mt-6 max-w-4xl text-xs leading-relaxed text-white/50">
          Amazon is an equal opportunity employer and does not discriminate on the basis of
          protected veteran status, race, religion, color, national origin, gender, sexual
          orientation, gender identity, genetic information, disability, age, or other legally
          protected status.
        </p>

        <div className="mt-6 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; 2026, Amazon Web Services, Inc. or its affiliates. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:underline">
              Privacy
            </a>
            <a href="#" className="hover:underline">
              Site terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
