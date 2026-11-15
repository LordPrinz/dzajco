/**
 * Most suites check the Polish pages, while a request without hints gets English. This asks for
 * Polish unless the test set its own `Accept-Language`. English pages are covered in `lang.test.ts`.
 */
export function inPolish(req: Request): Request {
  if (req.headers.has("Accept-Language")) return req;
  const copy = new Request(req);
  copy.headers.set("Accept-Language", "pl");
  return copy;
}
