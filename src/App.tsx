import { Page } from "@navikt/ds-react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import routes from "./routes.tsx";
import Footer from "./components/theme/Footer/Footer.tsx";
import ScrollToTop from "./components/theme/ScrollToTop/ScrollToTop.tsx";
import Header from "./components/theme/Header/Header.tsx";
import { useHead } from "@unhead/react";

import "./App.css";

// Create a wrapper component for ScrollToTop
const ScrollToTopWrapper = () => {
  const location = useLocation();

  // Don't show on /grafbygger route
  if (location.pathname === "/grafbygger") {
    return null;
  }

  return <ScrollToTop />;
};

// Create a wrapper component for Page Layout
const PageLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isBare = location.pathname === "/ai-bygger" || location.pathname === "/widget";

  if (isBare) {
    return <>{children}</>;
  }

  if (isHome) {
    return <main style={{ width: "100%" }}>{children}</main>;
  }

  return (
    <Page.Block as="main" width="xl" gutters>
      {children}
    </Page.Block>
  );
};

const AppShell = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isBare = location.pathname === "/ai-bygger" || location.pathname === "/widget";

  if (isBare) {
    return <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>{children}</div>;
  }

  return (
    <Page>
      <Header />
      <PageLayout>{children}</PageLayout>
      <ScrollToTopWrapper />
    </Page>
  );
};

const FooterWrapper = () => {
  const location = useLocation();
  if (location.pathname === '/ai-bygger' || location.pathname === '/widget') return null;
  return <Footer />;
};

function App() {
  useHead({
    script: [
      {
        defer: true,
        src: "https://cdn.nav.no/team-researchops/sporing/sporing.js",
        'data-host-url': "https://umami.nav.no",
        'data-domains': "startumami.ansatt.nav.no",
        'data-website-id': "8e935f84-fb1e-4d07-be28-410eb2ab8cb9"
      },
      {
        type: 'text/javascript',
        innerHTML: `
          window.SKYRA_CONFIG = {
            org: 'arbeids-og-velferdsetaten-nav'
          };
          var script = document.createElement('script');
          script.src = 'https://survey.skyra.no/skyra-survey.js';
          document.body.appendChild(script);
        `
      }
    ]
  });

  return (
    <Router>
      <AppShell>
        <Routes>
          {routes.map(({ path, component }) => (
            <Route key={path} path={path} element={component} />
          ))}
        </Routes>
      </AppShell>
      <FooterWrapper />
    </Router>
  );
}

export default App;
