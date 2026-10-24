import {
  isPublicPreloginRoute,
  matchRoutePattern,
  pathBelow,
} from '../../utils/publicPreloginRoutes';

const bases = {node: 'https://server.example/', ccxt: 'https://ccxt.example/'};
const pub = (m, u) => isPublicPreloginRoute(m, u, bases);

describe('publicPreloginRoutes', () => {
  it('matches like aq_backend utilities/routePattern.js', () => {
    expect(matchRoutePattern('/api/get-landing-page', '/api/get-landing-page/*')).toBe(true);
    expect(matchRoutePattern('/api/get-landing-page/x/y', '/api/get-landing-page/*')).toBe(true);
    expect(matchRoutePattern('/api/get-landing-pagex', '/api/get-landing-page/*')).toBe(false);
    expect(matchRoutePattern('/api/a/b', '/api/a/:id')).toBe(true);
    expect(matchRoutePattern('/api/a/', '/api/a/:id')).toBe(false);
    expect(matchRoutePattern('/api/a/b/c', '/api/a/:id')).toBe(false);
  });

  it('path below a base: strips query, collapses slashes', () => {
    expect(pathBelow('https://ccxt.example//misc/pdfs?x=1', bases.ccxt)).toBe('/misc/pdfs');
    expect(pathBelow('https://other/x', bases.ccxt)).toBeNull();
  });

  it('Node public routes, method-sensitive', () => {
    expect(pub('get', 'https://server.example/api/admin/frontend-config')).toBe(true);
    expect(pub('HEAD', 'https://server.example/api/admin/frontend-config')).toBe(true);
    expect(pub('POST', 'https://server.example/api/admin/frontend-config')).toBe(false);
    expect(pub('GET', 'https://server.example/api/app-advisor/get?appSubdomain=prod')).toBe(true);
    expect(pub('GET', 'https://server.example/api/advisor-config-env/getConfig/INH000')).toBe(true);
    expect(pub('POST', 'https://server.example/api/auth/check-provider')).toBe(true);
    expect(pub('POST', 'https://server.example/api/user/save-contact')).toBe(true);
    expect(pub('GET', 'https://server.example/api/user/getUser/a@b.c')).toBe(false);
    expect(pub('POST', 'https://server.example/api/user/')).toBe(false);
    expect(pub('POST', 'https://server.example/api/log-payment')).toBe(false);
  });

  it('pre-login-denied wins over a broader public pattern', () => {
    expect(pub('GET', 'https://server.example/api/admin/plan/detail/abc/advisor')).toBe(false);
    expect(pub('GET', 'https://server.example/api/admin/plan/adv/bespoke/a@b.c')).toBe(true);
  });

  it('ccxt public routes', () => {
    expect(pub('GET', 'https://ccxt.example/misc/videos?advisor=x')).toBe(true);
    expect(pub('GET', 'https://ccxt.example/misc/s3/blogs-content?page=1')).toBe(true);
    expect(pub('GET', 'https://ccxt.example/comms/reco/best-performer-closed-advice/adv/30')).toBe(true);
    expect(pub('POST', 'https://ccxt.example/misc/indices-previous-close')).toBe(true);
    expect(pub('POST', 'https://ccxt.example/rebalance/get-repair')).toBe(false);
    expect(pub('GET', 'https://elsewhere.example/misc/videos')).toBe(false);
  });
});
