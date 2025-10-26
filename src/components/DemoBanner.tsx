const DemoBanner = () => {
  return (
    <div className="bg-yellow-500/10 border-b border-yellow-500/30 py-2">
      <div className="container-netflix">
        <p className="text-yellow-200 text-sm text-center">
          🎭 <strong>Demo Environment:</strong> This is an educational demonstration of PostHog analytics. Not a real streaming service.
        </p>
      </div>
    </div>
  );
};

export default DemoBanner;