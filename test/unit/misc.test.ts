import { parseCookieString } from '../../src/services/misc';

describe('parseCookieString', () => {

  test('Properly parsing valid strings', () => {
    expect(parseCookieString('foo=bar')).toStrictEqual({ foo: "bar" });
    expect(parseCookieString('foo=bar; fem=baj')).toStrictEqual({ foo: "bar", fem: "baj" });
    expect(parseCookieString('foo=bar; fem=')).toStrictEqual({ foo: "bar", fem: "" });
    expect(parseCookieString('foo="bar"; fem=')).toStrictEqual({ foo: "bar", fem: "" });
  });

  test('Throwing error on invalid strings', () => {
    expect(() => parseCookieString('foo bar')).toThrow();
  });
});
