import { useState } from 'react';

// Dados fictícios simulando o que cadastramos no Neon DB
const PRODUTOS_MOCK = [
  { id: '22222222-2222-2222-2222-222222222222', descricao: 'Refrigerante Coca-Cola 350ml', preco: 4.50 },
  { id: '33333333-3333-3333-3333-333333333333', descricao: 'Salgado Assado - Coxinha', preco: 6.00 }
];

export default function PDV() {
  const [carrinho, setCarrinho] = useState<{ produtoId: string; descricao: string; quantidade: number; preco: number }[]>([]);
  const [statusVenda, setStatusVenda] = useState<'aberto' | 'processando' | 'sucesso' | 'erro'>('aberto');

  const adicionarAoCarrinho = (prod: typeof PRODUTOS_MOCK[0]) => {
    setCarrinho(prev => {
      const existe = prev.find(item => item.produtoId === prod.id);
      if (existe) {
        return prev.map(item => item.produtoId === prod.id ? { ...item, quantidade: item.quantidade + 1 } : item);
      }
      return [...prev, { produtoId: prod.id, descricao: prod.descricao, quantidade: 1, preco: prod.preco }];
    });
  };

  const valorTotal = carrinho.reduce((acc, item) => acc + (item.quantidade * item.preco), 0);

  const finalizarVenda = async () => {
    setStatusVenda('processando');
    
    // Payload JSON limpo e modular planejado para nossa arquitetura
    const payload = {
      cliente_id: '66666666-6666-6666-6666-666666666666', // Consumidor Padrão
      condicao_pagamento_id: '44444444-4444-4444-4444-444444444444', // PIX
      modelo: '65', // NFC-e
      itens: carrinho.map(item => ({
        produto_id: item.produtoId,
        quantidade: item.quantidade
      }))
    };

    console.log("Despachando payload para o ecossistema:", payload);

    // Simulação do delay de rede/comunicação com o banco Neon + n8n
    setTimeout(() => {
      setStatusVenda('sucesso');
      setCarrinho([]);
    }, 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 min-h-screen bg-slate-950 text-white font-sans">
      {/* Coluna 1 e 2: Vitrine de Produtos / Input de Código */}
      <div className="lg:col-span-2 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <h2 className="text-2xl font-bold text-cyan-400 mb-6 flex items-center gap-2">🛒 Frente de Caixa Inteligente</h2>
        
        {/* Grid de Produtos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PRODUTOS_MOCK.map(prod => (
            <button 
              key={prod.id}
              onClick={() => adicionarAoCarrinho(prod)}
              className="flex justify-between items-center p-4 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] rounded-xl border border-slate-700 transition duration-200 group text-left"
            >
              <div>
                <p className="font-semibold text-slate-200 group-hover:text-cyan-300 transition">{prod.descricao}</p>
                <p className="text-sm text-slate-400">Clique para adicionar</p>
              </div>
              <span className="text-lg font-bold text-emerald-400">R$ {prod.preco.toFixed(2)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Coluna 3: Cupom Atual / Carrinho e Fechamento */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
        <div>
          <h3 className="text-xl font-bold border-b border-slate-800 pb-3 mb-4 text-slate-300">Cupom Atual</h3>
          
          {carrinho.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="text-4xl mb-2">📥</p>
              <p>Nenhum item no caixa</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {carrinho.map(item => (
                <div key={item.produtoId} className="flex justify-between items-center bg-slate-850 p-3 rounded-lg border border-slate-800">
                  <div>
                    <p className="font-medium text-sm text-slate-200">{item.descricao}</p>
                    <p className="text-xs text-slate-400">{item.quantidade}x x R$ {item.preco.toFixed(2)}</p>
                  </div>
                  <span className="font-semibold text-slate-300">R$ {(item.quantidade * item.preco).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumo do Financeiro */}
        <div className="border-t border-slate-800 pt-4 mt-6">
          <div className="flex justify-between items-center text-xl font-extrabold mb-6">
            <span className="text-slate-400">TOTAL:</span>
            <span className="text-2xl text-emerald-400">R$ {valorTotal.toFixed(2)}</span>
          </div>

          {statusVenda === 'aberto' && (
            <button
              disabled={carrinho.length === 0}
              onClick={finalizarVenda}
              className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-700 text-slate-950 font-bold py-4 rounded-xl shadow-lg shadow-cyan-500/20 active:scale-[0.99] transition duration-200 border border-cyan-300 cursor-pointer"
            >
              Emitir Nota / Cupom (PIX)
            </button>
          )}

          {statusVenda === 'processando' && (
            <div className="w-full bg-slate-800 text-cyan-400 border border-cyan-500/30 text-center py-4 rounded-xl font-bold animate-pulse">
              ⚙️ Comunicando com SEFAZ...
            </div>
          )}

          {statusVenda === 'sucesso' && (
            <div className="w-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-center py-4 rounded-xl font-bold">
              ✅ Venda Salva & Títulos Gerados!
              <button onClick={() => setStatusVenda('aberto')} className="block mx-auto text-xs underline mt-1 text-slate-400 hover:text-white">Nova Venda</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
