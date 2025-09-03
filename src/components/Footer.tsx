import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-black text-white py-8 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap justify-center space-x-8 text-sm">
          <Link 
            to="/faq" 
            className="hover:text-gray-300 transition-colors"
          >
            FAQ
          </Link>
          <Link 
            to="/help" 
            className="hover:text-gray-300 transition-colors"
          >
            Help Center
          </Link>
          <Link 
            to="/terms" 
            className="hover:text-gray-300 transition-colors"
          >
            Terms of Use
          </Link>
          <Link 
            to="/privacy" 
            className="hover:text-gray-300 transition-colors"
          >
            Privacy
          </Link>
        </div>
        <div className="text-center text-gray-400 text-xs mt-4">
          © 2024 HogFlix. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;