import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPublicContacts } from "./contact-extraction.ts";

test("extractPublicContacts accepts explicit phones in vehicle listing context", () => {
  const contacts = extractPublicContacts({
    url: "https://auto.ru/cars/used/sale/example",
    title: "BMW X5 продажа",
    snippet: "Автомобиль с пробегом. Телефон +7 999 123-45-67",
  });

  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].kind, "phone");
  assert.equal(contacts[0].value, "+79991234567");
  assert.ok(contacts[0].signals.includes("known_vehicle_listing_domain"));
});

test("extractPublicContacts rejects phones without vehicle sale context", () => {
  const contacts = extractPublicContacts({
    url: "https://example.com/profile",
    title: "Personal page",
    snippet: "Call +7 999 123-45-67",
  });

  assert.deepEqual(contacts, []);
});
