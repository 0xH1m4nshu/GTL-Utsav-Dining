import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';
import Footer from './Footer';
import ChatAssistant from './ChatAssistant';

const Layout = ({ children }) => (
  <>
    <NavBar />
    <main>{children ?? <Outlet />}</main>
    <Footer />
    <ChatAssistant />
  </>
);

export default Layout;
