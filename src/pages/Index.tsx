import Header from '@/components/Header';

const Index = () => {
  return (
    <div className="min-h-screen bg-background-dark">
      <Header />
      
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
        <div className="text-center container-netflix">
          <h1 className="text-6xl font-bold mb-6 text-primary-red font-manrope">
            HogFlix
          </h1>
          <p className="text-xl text-text-secondary mb-4 font-manrope">
            Your Premium Streaming Experience
          </p>
          <p className="text-sm text-text-tertiary font-manrope">
            Netflix-Style Design System • Supabase Connected • Ready for Development
          </p>
          
          {/* Demo Button */}
          <button className="mt-8 btn-primary px-8 py-3 rounded font-manrope">
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
};

export default Index;
