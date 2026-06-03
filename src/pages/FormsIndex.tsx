import { Link } from "react-router-dom";

const PRODUCTS = ["subscription", "profile", "payment", "watchlist"] as const;

const FormsIndex = () => (
  <main className="min-h-screen flex items-center justify-center p-8 bg-background">
    <div className="space-y-4 w-full max-w-md">
      <h1 className="text-2xl font-semibold mb-2">Hogflix forms demo</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Multi-product funnel. Each form fires <code>start_form</code> on mount and{" "}
        <code>finish_form</code> on submit, both with <code>product_id</code>.
      </p>
      {PRODUCTS.map((p) => (
        <Link
          key={p}
          to={`/forms/${p}`}
          className="block px-6 py-3 bg-primary text-primary-foreground rounded hover:opacity-90 text-center"
        >
          {p}
        </Link>
      ))}
    </div>
  </main>
);

export default FormsIndex;
