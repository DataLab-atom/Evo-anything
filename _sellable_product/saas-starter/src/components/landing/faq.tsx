"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How do I get started?",
    answer:
      "Sign up for a free account and you can start using the platform immediately. No credit card required for the free tier.",
  },
  {
    question: "Can I change my plan later?",
    answer:
      "Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately and billing is prorated.",
  },
  {
    question: "Is there a free trial for paid plans?",
    answer:
      "Yes, all paid plans come with a 14-day free trial. You can explore all premium features before committing.",
  },
  {
    question: "How does team billing work?",
    answer:
      "Each plan has a team member limit. The plan cost covers all team members within that limit. Additional members require an upgrade.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, Mastercard, American Express) through our secure Stripe integration.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Absolutely. You can cancel your subscription at any time from the billing dashboard. You'll continue to have access until the end of your billing period.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="container space-y-12 py-8 md:py-12 lg:py-24">
      <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
        <h2 className="text-3xl font-bold leading-[1.1] sm:text-3xl md:text-5xl">
          Frequently Asked Questions
        </h2>
        <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
          Find answers to common questions about our platform.
        </p>
      </div>

      <div className="mx-auto max-w-3xl">
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
