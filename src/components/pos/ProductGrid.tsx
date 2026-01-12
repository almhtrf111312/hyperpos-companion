import { Search, Barcode, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  image?: string;
}

interface ProductGridProps {
  products: Product[];
  categories: string[];
  searchQuery: string;
  selectedCategory: string;
  onSearchChange: (query: string) => void;
  onCategoryChange: (category: string) => void;
  onProductClick: (product: Product) => void;
}

export function ProductGrid({
  products,
  categories,
  searchQuery,
  selectedCategory,
  onSearchChange,
  onCategoryChange,
  onProductClick,
}: ProductGridProps) {
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'الكل' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Search and Categories */}
      <div className="p-3 md:p-4 border-b border-border space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="بحث عن منتج..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pr-9 md:pr-10 h-10 md:h-12 bg-muted border-0 text-sm md:text-base"
            />
          </div>
          <Button variant="outline" size="icon" className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0">
            <Barcode className="w-4 h-4 md:w-5 md:h-5" />
          </Button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 md:mx-0 md:px-0">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => onCategoryChange(category)}
              className={cn(
                "px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-medium whitespace-nowrap transition-all flex-shrink-0",
                selectedCategory === category
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="flex-1 p-3 md:p-4 overflow-y-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3">
          {filteredProducts.map((product, index) => (
            <button
              key={product.id}
              onClick={() => onProductClick(product)}
              className="pos-item text-right fade-in p-2.5 md:p-4"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div className="w-full aspect-square rounded-lg bg-muted/50 flex items-center justify-center mb-2 md:mb-3">
                <Package className="w-8 h-8 md:w-12 md:h-12 text-muted-foreground/50" />
              </div>
              <h3 className="font-semibold text-foreground text-xs md:text-sm line-clamp-2 mb-1">
                {product.name}
              </h3>
              <p className="text-primary font-bold text-sm md:text-base">${product.price}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">
                المخزون: {product.quantity}
              </p>
            </button>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Package className="w-12 h-12 mb-2 opacity-50" />
            <p>لا توجد منتجات</p>
          </div>
        )}
      </div>
    </div>
  );
}
