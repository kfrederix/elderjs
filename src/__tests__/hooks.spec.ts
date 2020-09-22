import hooks from '../hooks';

jest.mock('../externalHelpers', () => () => Promise.resolve({ permalink: jest.fn() }));

jest.mock('../utils/prepareShortcodeParser', () => ({ customJsStack, cssStack, headStack }) => ({
  parse: (templateHtml) => {
    customJsStack.push('console.log("test");');
    cssStack.push('body{display:none;}');
    headStack.push('<title>Hello</title>');
    return Promise.resolve(`..${templateHtml}..`);
  },
}));

jest.mock('../utils/Page', () => {
  return jest.fn(() => ({
    html: () => Promise.resolve(`<html>new page</html>`),
  }));
});

process.cwd = () => 'test';

jest.mock('path', () => ({
  resolve: (...strings) => strings.join('/').replace('./', '').replace('//', '/'),
  posix: () => ({ dirname: () => '' }),
}));

jest.mock('fs-extra', () => ({
  writeJSONSync: jest.fn(),
  outputFileSync: jest
    .fn()
    .mockImplementationOnce(() => {})
    .mockImplementationOnce(() => {
      throw new Error('Failed to write');
    }),
}));

describe('#hooks', () => {
  it('has valid priority', () => {
    expect(hooks.filter((h) => h.priority < 1 && h.priority > 100)).toEqual([]);
  });
  it('matchesSnapshot', () => {
    expect(hooks).toMatchSnapshot();
  });
  it('elderAddExternalHelpers', async () => {
    const hook = hooks.find((h) => h.name === 'elderAddExternalHelpers');
    expect(await hook.run({ helpers: { old: jest.fn() }, query: {}, settings: {} })).toMatchSnapshot();
  });
  it('elderExpressLikeMiddleware', async () => {
    const hook = hooks.find((h) => h.name === 'elderExpressLikeMiddleware');
    const next = () => 'next() was called';
    const settings = {
      server: {
        prefix: '/dev',
      },
    };
    // prefix not found
    expect(
      await hook.run({
        next,
        req: { path: '/' },
        settings,
      }),
    ).toEqual('next() was called');
    const headers = [];
    const end = jest.fn();
    // route found with slash added
    expect(
      await hook.run({
        next,
        req: { path: '/dev' },
        res: {
          headerSent: false,
          setHeader: (key, val) => {
            headers.push(`${key}-${val}`);
          },
          end,
        },
        routes: {
          Home: {
            data: { foo: 'bar' },
          },
        },
        serverLookupObject: {
          '/dev/': {
            route: 'Home',
          },
        },
        settings,
      }),
    ).toEqual({});
    expect(end).toHaveBeenCalledTimes(1);
    expect(headers).toEqual(['Content-Type-text/html']);
  });
  it('elderProcessShortcodes', async () => {
    const hook = hooks.find((h) => h.name === 'elderProcessShortcodes');
    const headStack = [];
    const cssStack = [];
    const customJsStack = [];
    expect(
      await hook.run({
        headStack,
        cssStack,
        customJsStack,
        templateHtml: '<html>hi</html>',
        helpers: {},
        query: {},
        settings: {},
      }),
    ).toEqual({
      cssStack: ['body{display:none;}'],
      customJsStack: ['console.log("test");'],
      headStack: ['<title>Hello</title>'],
      templateHtml: '..<html>hi</html>..',
    });
  });
  it('elderAddMetaCharsetToHead', async () => {
    const hook = hooks.find((h) => h.name === 'elderAddMetaCharsetToHead');
    expect(await hook.run({ headStack: [] })).toMatchSnapshot();
  });
  it('elderAddMetaViewportToHead', async () => {
    const hook = hooks.find((h) => h.name === 'elderAddMetaViewportToHead');
    expect(await hook.run({ headStack: [] })).toMatchSnapshot();
  });
  it('elderAddDefaultIntersectionObserver', async () => {
    const hook = hooks.find((h) => h.name === 'elderAddDefaultIntersectionObserver');
    expect(await hook.run({ beforeHydrateStack: [] })).toMatchSnapshot();
  });
  it('elderAddSystemJs', async () => {
    const hook = hooks.find((h) => h.name === 'elderAddSystemJs');
    expect(await hook.run({ beforeHydrateStack: [], headStack: [] })).toMatchSnapshot();
  });

  it('elderCompileHtml', async () => {
    const hook = hooks.find((h) => h.name === 'elderCompileHtml');
    expect(
      await hook.run({
        request: { route: 'test' },
        headString: 'head',
        footerString: 'footer',
        layoutHtml: 'layout',
      }),
    ).toStrictEqual({
      htmlString: '<!DOCTYPE html><html lang="en"><head>head</head><body class="test">layoutfooter</body></html>',
    });
  });

  it('elderConsoleLogErrors', async () => {
    const hook = hooks.find((h) => h.name === 'elderConsoleLogErrors');
    expect(
      await hook.run({ settings: { worker: false }, request: { permalink: '/foo' }, errors: ['foo', 'bar'] }),
    ).toBe(undefined);
  });
  it('elderWriteHtmlFileToPublic', async () => {
    const hook = hooks.find((h) => h.name === 'elderWriteHtmlFileToPublic');
    expect(
      await hook.run({
        request: { permalink: '/foo' },
        htmlString: '<html>string</html>',
        errors: [],
        settings: {},
      }),
    ).toBe(null);
    expect(
      await hook.run({
        request: { permalink: '/foo' },
        htmlString: '<html>string</html>',
        errors: [],
        settings: { build: './build', locations: { public: './public' } },
      }),
    ).toBe(null);
    expect(
      await hook.run({
        request: { permalink: '/foo' },
        htmlString: '<html>string</html>',
        errors: [],
        settings: { build: './build', locations: { public: './public' } },
      }),
    ).toEqual({ errors: [new Error('Failed to write')] });
  });
  it('elderDisplayRequestTime', async () => {
    const hook = hooks.find((h) => h.name === 'elderDisplayRequestTime');
    expect(
      await hook.run({
        request: { permalink: '/foo' },
        timings: [
          { name: 'foo', duration: 500 },
          { name: 'bar', duration: 250 },
        ],
        settings: { debug: { performance: true } },
      }),
    ).toBe(undefined);
  });
  it('elderShowParsedBuildTimes', async () => {
    const hook = hooks.find((h) => h.name === 'elderShowParsedBuildTimes');
    expect(
      await hook.run({
        timings: [
          [
            { name: 'foo', duration: 500 },
            { name: 'bar', duration: 250 },
          ],
          [
            { name: 'foo', duration: 2500 },
            { name: 'bar', duration: 0 },
          ],
        ],
        settings: { debug: { performance: true } },
      }),
    ).toBe(undefined);
  });
  it('elderWriteBuildErrors', async () => {
    const hook = hooks.find((h) => h.name === 'elderWriteBuildErrors');
    expect(
      await hook.run({
        errors: ['error1', 'error2'],
        settings: { debug: { performance: true } },
      }),
    ).toBe(undefined);
  });
});
