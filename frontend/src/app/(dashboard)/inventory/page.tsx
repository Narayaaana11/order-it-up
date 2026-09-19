'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useFormatDate } from '@/hooks/useFormatDate';
import { 
  Boxes, 
  Plus, 
  AlertTriangle, 
  Edit, 
  Trash2, 
  Layers, 
  History, 
  Search, 
  CheckCircle2, 
  X, 
  ChefHat, 
  Scale, 
  DollarSign, 
  ArrowUpDown,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

interface RawIngredient {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  cost_per_unit: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface ProductItem {
  id: number;
  name: string;
  price: number;
  category_id?: string;
}

interface RecipeItem {
  id?: string;
  ingredient_id: string;
  ingredient_name?: string;
  quantity_required: number;
  unit: string;
  wastage_percentage: number;
  cost_per_unit?: number;
  current_stock?: number;
}

interface InventoryTx {
  id: number;
  ingredient_id: string;
  ingredient_name: string;
  ingredient_unit: string;
  type: string;
  quantity: number;
  balance_after: number;
  reference_id: string;
  created_at: string;
}

export default function InventoryPage() {
  const formatCurrency = useFormatCurrency();
  const formatDate = useFormatDate();

  const [activeTab, setActiveTab] = useState<'ingredients' | 'recipes' | 'audit'>('ingredients');
  const [ingredients, setIngredients] = useState<RawIngredient[]>([]);
  const [lowStockList, setLowStockList] = useState<RawIngredient[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<RawIngredient | null>(null);
  const [adjustingIngredient, setAdjustingIngredient] = useState<RawIngredient | null>(null);

  // Form states
  const [form, setForm] = useState({
    name: '',
    unit: 'kg',
    current_stock: 0,
    minimum_stock: 5,
    cost_per_unit: 0,
  });

  const [adjustForm, setAdjustForm] = useState({
    adjustment_type: 'increase' as 'increase' | 'decrease' | 'set',
    quantity: 1,
    reason: 'Restocked delivery',
  });

  // Recipe states
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [recipeCogs, setRecipeCogs] = useState<number>(0);
  const [savingRecipe, setSavingRecipe] = useState(false);

  // Load basic data
  const loadData = async () => {
    setLoading(true);
    try {
      const [ingRes, lowRes, prodRes] = await Promise.allSettled([
        api.get('/api/inventory/ingredients'),
        api.get('/api/inventory/low-stock'),
        api.get('/api/products'),
      ]);

      if (ingRes.status === 'fulfilled' && ingRes.value.data?.ingredients) {
        setIngredients(ingRes.value.data.ingredients);
      }
      if (lowRes.status === 'fulfilled' && lowRes.value.data?.low_stock) {
        setLowStockList(lowRes.value.data.low_stock);
      }
      if (prodRes.status === 'fulfilled' && prodRes.value.data?.products) {
        setProducts(prodRes.value.data.products);
        if (!selectedProductId && prodRes.value.data.products.length > 0) {
          setSelectedProductId(prodRes.value.data.products[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load inventory data', err);
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const loadAudit = async () => {
    try {
      const res = await api.get('/api/inventory/transactions?limit=50');
      if (res.data?.transactions) {
        setTransactions(res.data.transactions);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadRecipe = async (prodId: number) => {
    try {
      const res = await api.get(`/api/inventory/recipes/${prodId}`);
      if (res.data?.recipes) {
        setRecipeItems(res.data.recipes);
        setRecipeCogs(res.data.recipe_cogs || 0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAudit();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedProductId) {
      loadRecipe(selectedProductId);
    }
  }, [selectedProductId]);

  // Handle Save Ingredient
  const handleSaveIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Ingredient name is required');
      return;
    }

    try {
      if (editingIngredient) {
        await api.put(`/api/inventory/ingredients/${editingIngredient.id}`, {
          name: form.name,
          unit: form.unit,
          minimum_stock: form.minimum_stock,
          cost_per_unit: form.cost_per_unit,
        });
        toast.success('Ingredient updated');
      } else {
        await api.post('/api/inventory/ingredients', form);
        toast.success('Ingredient created');
      }
      setShowAddModal(false);
      setEditingIngredient(null);
      setForm({ name: '', unit: 'kg', current_stock: 0, minimum_stock: 5, cost_per_unit: 0 });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save ingredient');
    }
  };

  // Handle Stock Adjustment
  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingIngredient) return;

    try {
      await api.post('/api/inventory/adjust', {
        ingredient_id: adjustingIngredient.id,
        adjustment_type: adjustForm.adjustment_type,
        quantity: adjustForm.quantity,
        reason: adjustForm.reason,
      });
      toast.success('Stock adjusted successfully');
      setAdjustingIngredient(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to adjust stock');
    }
  };

  // Delete ingredient
  const handleDeleteIngredient = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this ingredient?')) return;
    try {
      await api.delete(`/api/inventory/ingredients/${id}`);
      toast.success('Ingredient deactivated');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  // Save Recipe
  const handleSaveRecipe = async () => {
    if (!selectedProductId) return;
    setSavingRecipe(true);
    try {
      const itemsPayload = recipeItems.map(item => ({
        ingredient_id: item.ingredient_id,
        quantity_required: item.quantity_required,
        unit: item.unit,
        wastage_percentage: item.wastage_percentage || 0,
      }));

      const res = await api.post(`/api/inventory/recipes/${selectedProductId}`, { items: itemsPayload });
      toast.success('Recipe Bill of Materials saved!');
      setRecipeCogs(res.data?.recipe_cogs || 0);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save recipe');
    } finally {
      setSavingRecipe(false);
    }
  };

  const addRecipeRow = () => {
    if (ingredients.length === 0) {
      toast.error('Add raw ingredients first!');
      return;
    }
    const defaultIng = ingredients[0];
    setRecipeItems([
      ...recipeItems,
      {
        ingredient_id: defaultIng.id,
        ingredient_name: defaultIng.name,
        quantity_required: 1,
        unit: defaultIng.unit,
        wastage_percentage: 0,
        cost_per_unit: defaultIng.cost_per_unit,
      },
    ]);
  };

  const removeRecipeRow = (index: number) => {
    setRecipeItems(recipeItems.filter((_, i) => i !== index));
  };

  const filteredIngredients = ingredients.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const grossMargin = selectedProduct && selectedProduct.price > 0
    ? Math.round(((selectedProduct.price - recipeCogs) / selectedProduct.price) * 100)
    : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Inventory & Recipe Costing</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-medium">
              BOM Engine Active
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Track raw materials, automate kitchen stock deduction, and calculate live recipe COGS margins.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'ingredients' && (
            <Button
              onClick={() => {
                setEditingIngredient(null);
                setForm({ name: '', unit: 'kg', current_stock: 0, minimum_stock: 5, cost_per_unit: 0 });
                setShowAddModal(true);
              }}
              size="sm"
              className="gap-2 bg-primary text-primary-foreground"
            >
              <Plus className="w-4 h-4" />
              Add Ingredient
            </Button>
          )}
          <Button
            onClick={loadData}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Low Stock Warning Banner */}
      {lowStockList.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-600 dark:text-amber-400">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="font-semibold text-sm">
                Low Stock Alert: {lowStockList.length} ingredient{lowStockList.length > 1 ? 's' : ''} below threshold!
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                {lowStockList.map(i => `${i.name} (${i.current_stock} ${i.unit})`).join(', ')}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setActiveTab('ingredients')}
            size="sm"
            variant="outline"
            className="border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs shrink-0"
          >
            Manage Stock
          </Button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-border/40 gap-4 text-sm font-medium">
        <button
          onClick={() => setActiveTab('ingredients')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'ingredients'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Boxes className="w-4 h-4" />
          Raw Ingredients ({ingredients.length})
        </button>

        <button
          onClick={() => setActiveTab('recipes')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'recipes'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ChefHat className="w-4 h-4" />
          Recipe BOM & Margins
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'audit'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="w-4 h-4" />
          Inventory Audit Log
        </button>
      </div>

      {/* TAB 1: RAW INGREDIENTS */}
      {activeTab === 'ingredients' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex items-center gap-2 max-w-sm bg-muted/40 border border-border/40 px-3 py-1.5 rounded-xl">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search ingredients..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent text-sm w-full focus:outline-none"
            />
          </div>

          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20 text-muted-foreground">
                    <th className="py-3 px-4 font-medium">Ingredient Name</th>
                    <th className="py-3 px-4 font-medium text-right">Current Stock</th>
                    <th className="py-3 px-4 font-medium text-right">Min Threshold</th>
                    <th className="py-3 px-4 font-medium text-right">Unit Cost</th>
                    <th className="py-3 px-4 font-medium text-right">Total Asset Value</th>
                    <th className="py-3 px-4 font-medium text-center">Status</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filteredIngredients.length > 0 ? (
                    filteredIngredients.map(ing => {
                      const isLow = ing.current_stock <= ing.minimum_stock;
                      const isOut = ing.current_stock <= 0;
                      const assetVal = ing.current_stock * ing.cost_per_unit;

                      return (
                        <tr key={ing.id} className="hover:bg-muted/10 transition-colors">
                          <td className="py-3 px-4 font-medium text-foreground">
                            {ing.name}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold">
                            {ing.current_stock} <span className="text-muted-foreground text-[10px]">{ing.unit}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                            {ing.minimum_stock} {ing.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            {formatCurrency(ing.cost_per_unit)} / {ing.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">
                            {formatCurrency(assetVal)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isOut ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                                Out of Stock
                              </span>
                            ) : isLow ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                Low Stock
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                In Stock
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                onClick={() => {
                                  setAdjustingIngredient(ing);
                                  setAdjustForm({ adjustment_type: 'increase', quantity: 1, reason: 'Restocked' });
                                }}
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] px-2"
                              >
                                Adjust
                              </Button>
                              <Button
                                onClick={() => {
                                  setEditingIngredient(ing);
                                  setForm({
                                    name: ing.name,
                                    unit: ing.unit,
                                    current_stock: ing.current_stock,
                                    minimum_stock: ing.minimum_stock,
                                    cost_per_unit: ing.cost_per_unit,
                                  });
                                  setShowAddModal(true);
                                }}
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                              >
                                <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                              <Button
                                onClick={() => handleDeleteIngredient(ing.id)}
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        No raw ingredients configured yet. Click "Add Ingredient" to start tracking inventory.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RECIPE BOM & COGS */}
      {activeTab === 'recipes' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product selector list */}
          <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm space-y-3">
            <h3 className="font-semibold text-sm">Select Menu Product</h3>
            <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
              {products.map(prod => (
                <button
                  key={prod.id}
                  onClick={() => setSelectedProductId(prod.id)}
                  className={`w-full text-left p-3 rounded-xl text-xs transition-all flex items-center justify-between ${
                    selectedProductId === prod.id
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                      : 'hover:bg-muted/40 text-foreground'
                  }`}
                >
                  <span>{prod.name}</span>
                  <span className="font-mono">{formatCurrency(prod.price)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recipe Editor */}
          <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm lg:col-span-2 space-y-5">
            {selectedProduct ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/30">
                  <div>
                    <h3 className="text-base font-bold">{selectedProduct.name} — Recipe BOM</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Selling Price: {formatCurrency(selectedProduct.price)}
                    </p>
                  </div>

                  {/* Gross Margin Card */}
                  <div className="flex items-center gap-4 bg-muted/40 px-4 py-2 rounded-xl border border-border/40">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Recipe COGS</span>
                      <p className="text-sm font-bold font-mono text-red-500">
                        {formatCurrency(recipeCogs)}
                      </p>
                    </div>
                    <div className="h-7 w-[1px] bg-border" />
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Gross Margin</span>
                      <p className={`text-sm font-bold font-mono ${grossMargin >= 65 ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {grossMargin}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recipe Ingredient Rows */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Required Raw Ingredients</span>
                    <Button onClick={addRecipeRow} size="sm" variant="outline" className="h-7 text-xs gap-1">
                      <Plus className="w-3.5 h-3.5" />
                      Add Ingredient
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {recipeItems.length > 0 ? (
                      recipeItems.map((item, index) => (
                        <div key={index} className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-muted/20 border border-border/40 text-xs">
                          {/* Ingredient Select */}
                          <div className="flex-1 min-w-[160px]">
                            <select
                              value={item.ingredient_id}
                              onChange={e => {
                                const sel = ingredients.find(ing => ing.id === e.target.value);
                                const updated = [...recipeItems];
                                updated[index] = {
                                  ...updated[index],
                                  ingredient_id: e.target.value,
                                  ingredient_name: sel?.name,
                                  unit: sel?.unit || 'kg',
                                  cost_per_unit: sel?.cost_per_unit,
                                };
                                setRecipeItems(updated);
                              }}
                              className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 focus:outline-none"
                            >
                              {ingredients.map(ing => (
                                <option key={ing.id} value={ing.id}>
                                  {ing.name} ({ing.unit})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Quantity */}
                          <div className="w-24">
                            <input
                              type="number"
                              step="any"
                              value={item.quantity_required}
                              onChange={e => {
                                const updated = [...recipeItems];
                                updated[index].quantity_required = Number(e.target.value);
                                setRecipeItems(updated);
                              }}
                              placeholder="Qty"
                              className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 font-mono text-right focus:outline-none"
                            />
                          </div>

                          {/* Unit display */}
                          <div className="w-12 text-muted-foreground font-mono">
                            {item.unit}
                          </div>

                          {/* Wastage % */}
                          <div className="w-24 flex items-center gap-1">
                            <input
                              type="number"
                              value={item.wastage_percentage}
                              onChange={e => {
                                const updated = [...recipeItems];
                                updated[index].wastage_percentage = Number(e.target.value);
                                setRecipeItems(updated);
                              }}
                              placeholder="Waste %"
                              className="w-full bg-background border border-border rounded-lg px-2 py-1.5 font-mono text-right focus:outline-none text-[11px]"
                            />
                            <span className="text-muted-foreground">%</span>
                          </div>

                          {/* Cost line */}
                          <div className="w-20 text-right font-mono font-semibold">
                            {formatCurrency(
                              (item.quantity_required || 0) * 
                              (item.cost_per_unit || 0) * 
                              (1 + (item.wastage_percentage || 0) / 100)
                            )}
                          </div>

                          {/* Remove button */}
                          <Button
                            onClick={() => removeRecipeRow(index)}
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground py-6 text-center">
                        No recipe linked yet. Click "Add Ingredient" to configure the Bill of Materials.
                      </p>
                    )}
                  </div>

                  <div className="pt-3 flex justify-end">
                    <Button
                      onClick={handleSaveRecipe}
                      disabled={savingRecipe}
                      size="sm"
                      className="gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {savingRecipe ? 'Saving...' : 'Save Recipe BOM'}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground py-12 text-center">
                Select a product to view and edit its recipe.
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT TRANSACTIONS LOG */}
      {activeTab === 'audit' && (
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20 text-muted-foreground">
                  <th className="py-3 px-4 font-medium">Timestamp</th>
                  <th className="py-3 px-4 font-medium">Ingredient</th>
                  <th className="py-3 px-4 font-medium">Type</th>
                  <th className="py-3 px-4 font-medium text-right">Delta Qty</th>
                  <th className="py-3 px-4 font-medium text-right">Balance After</th>
                  <th className="py-3 px-4 font-medium">Reference / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {transactions.length > 0 ? (
                  transactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-muted/10">
                      <td className="py-2.5 px-4 font-mono text-muted-foreground">
                        {tx.created_at}
                      </td>
                      <td className="py-2.5 px-4 font-medium">
                        {tx.ingredient_name}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-muted text-muted-foreground">
                          {tx.type}
                        </span>
                      </td>
                      <td className={`py-2.5 px-4 text-right font-mono font-bold ${tx.quantity >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {tx.quantity >= 0 ? `+${tx.quantity}` : tx.quantity} {tx.ingredient_unit}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold">
                        {tx.balance_after} {tx.ingredient_unit}
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground">
                        {tx.reference_id || 'System deduction'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No stock audit transactions logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Ingredient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <h3 className="font-bold text-base">
                {editingIngredient ? 'Edit Ingredient' : 'New Raw Ingredient'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveIngredient} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-foreground">Ingredient Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Cheddar Cheese, Brioche Bun, Espresso Beans"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:outline-none text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Measurement Unit</label>
                  <select
                    value={form.unit}
                    onChange={e => setForm({ ...form, unit: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:outline-none"
                  >
                    <option value="kg">Kilograms (kg)</option>
                    <option value="g">Grams (g)</option>
                    <option value="l">Liters (l)</option>
                    <option value="ml">Milliliters (ml)</option>
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="box">Box / Pack</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-foreground">Cost Per Unit</label>
                  <input
                    type="number"
                    step="any"
                    value={form.cost_per_unit}
                    onChange={e => setForm({ ...form, cost_per_unit: Number(e.target.value) })}
                    placeholder="e.g., 250"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 font-mono focus:outline-none"
                  />
                </div>
              </div>

              {!editingIngredient && (
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Opening Initial Stock</label>
                  <input
                    type="number"
                    step="any"
                    value={form.current_stock}
                    onChange={e => setForm({ ...form, current_stock: Number(e.target.value) })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 font-mono focus:outline-none"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="font-medium text-foreground">Minimum Stock Alert Threshold</label>
                <input
                  type="number"
                  step="any"
                  value={form.minimum_stock}
                  onChange={e => setForm({ ...form, minimum_stock: Number(e.target.value) })}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 font-mono focus:outline-none"
                />
                <p className="text-[10px] text-muted-foreground">Pings when inventory falls below this quantity.</p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingIngredient ? 'Save Changes' : 'Create Ingredient'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustingIngredient && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <div>
                <h3 className="font-bold text-base">Adjust Stock Level</h3>
                <p className="text-xs text-muted-foreground">{adjustingIngredient.name}</p>
              </div>
              <button onClick={() => setAdjustingIngredient(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStockAdjustment} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-foreground">Adjustment Mode</label>
                <div className="grid grid-cols-3 gap-1 bg-muted p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setAdjustForm({ ...adjustForm, adjustment_type: 'increase' })}
                    className={`py-1.5 rounded-lg font-medium transition-all ${
                      adjustForm.adjustment_type === 'increase' ? 'bg-background text-emerald-500 shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    + Add Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustForm({ ...adjustForm, adjustment_type: 'decrease' })}
                    className={`py-1.5 rounded-lg font-medium transition-all ${
                      adjustForm.adjustment_type === 'decrease' ? 'bg-background text-red-500 shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    - Reduce
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustForm({ ...adjustForm, adjustment_type: 'set' })}
                    className={`py-1.5 rounded-lg font-medium transition-all ${
                      adjustForm.adjustment_type === 'set' ? 'bg-background text-blue-500 shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    = Set Exact
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-foreground">
                  Quantity ({adjustingIngredient.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={adjustForm.quantity}
                  onChange={e => setAdjustForm({ ...adjustForm, quantity: Number(e.target.value) })}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 font-mono text-sm focus:outline-none"
                />
                <p className="text-[10px] text-muted-foreground">
                  Current Stock: {adjustingIngredient.current_stock} {adjustingIngredient.unit}
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-foreground">Reason for Adjustment</label>
                <input
                  type="text"
                  value={adjustForm.reason}
                  onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  placeholder="e.g. Vendor delivery, Spoilage, Physical audit"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setAdjustingIngredient(null)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Confirm Adjustment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
