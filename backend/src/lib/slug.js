"use strict";

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function uniqueSlug(base, suffix) {
  const clean = slugify(base) || "business";
  return `${clean}-${suffix}`.slice(0, 80);
}

module.exports = { slugify, uniqueSlug };
