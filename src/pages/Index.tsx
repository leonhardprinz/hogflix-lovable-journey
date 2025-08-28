// Update this page (the content is just a fallback if you fail to update the page)

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center container-netflix">
        <h1 className="text-6xl font-bold mb-6 text-primary font-manrope">
          HogFlix
        </h1>
        <p className="text-xl text-secondary mb-4 font-manrope">
          Your Premium Streaming Experience
        </p>
        <p className="text-sm text-tertiary font-manrope">
          Netflix-Style Design System • Supabase Connected • Ready for Development
        </p>
        
        {/* Demo Button */}
        <button className="mt-8 btn-primary px-8 py-3 rounded font-manrope">
          Get Started
        </button>
      </div>
    </div>
  );
};

export default Index;
