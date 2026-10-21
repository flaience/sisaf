import { useState } from 'react';

// Dados simulando o que criamos no Neon DB
const CLIENTES_MOCK = [
  { id: '66666666-6666-6666-6666-666666666666', nome: 'Consumidor Final de Teste', documento: '99.999.999/9999-99', tipo: 'Física' },
  { id: '77777777-7777-7777-7777-777777777777', nome: 'Empresa Parceira Distribuidora Ltda', documento: '12.345.678/0001-99', tipo: 'Jurídica' }
];

const CONDICOES_MOCK = [
  { id: '44444444-4444-4444-4444-444444444444', descricao: 'PIX à Vista' },
  { id: '55555555-5555-5555-5555-555555555555', descricao: 'Cartão de Crédito 3x (30/60/90 dias)' }
];

const PRODUTOS_MOCK = [
  { id: '22222222-2222-2222-2222-222222222222', descricao: 'Refrigerante Coca-Cola 350ml', preco: 4.50, ncm: '22021000' },
  { id: '33333333-3333-3333-3333-333333333333', descricao: 'Salgado Assado - Coxinha', preco: 6.00, ncm: '19022000' }
];

export default function EmissaoNFe() {
  const [clienteSelecionado, setClienteSelecionado] = useState('');
  const [condicaoSelecionada, setCondicaoSelecionada] = useState('');
  const [carrinho, setCarrinho] = useState<{ produtoId: string; descricao: string; quantidade: number; preco: number; ncm: string }[]>([]);
  const [statusNota, setStatusNota] = useState<'aberto' | 'processando' | 'emitida' | 'erro'>('aberto');

  const adicionarProduto = (prodId: string) => {
    const prod = PRODUTOS_MOCK.find(p => p.id === prodId);
    if (!prod) return;
    
    setCarrinho(prev => {
      const existe = prev.find(item => item.produtoId === prod.id);
      if (existe) {
        return prev.map(item => item.produtoId === prod.id ? { ...item, quantidade: item.quantidade + 1 } : item);
      }
      return [...prev, { produtoId: prod.id, descricao: prod.descricao, quantidade: 1, preco: prod.preco, ncm: prod.ncm }];
    });
  };

  const valorTotal = carrinho.reduce((acc, item) => acc + (item.quantidade * item.preco), 0);

  const transmitirNFe = async () => {
    if (!clienteSelecionado || !condicaoSelecionada || carrinho.length === 0) return;
    
    setStatusNota('processando');
    
    // O exato Payload JSON esperado pela nossa função RPC e pelo n8n
    const payload = {
      cliente_id: clienteSelecionado,
      condicao_pagamento_id: condicaoSelecionada,
      modelo: '55', // Configurado explicitamente como NF-e Modelo 55
      itens: carrinho.map(item => ({
        produto_id: item.produtoId,
        quantidade: item.quantidade
      }))
    };

    console.log("Despachando NF-e Modelo 55 para o ecossistema:", payload);

    setTimeout(() => {
      setStatusNota('emitida');
      setCarrinho([]);
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 font-sans">
      <div className="max-w-5xl mx-auto bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl">
        <h1 className="text-3xl font-extrabold text-cyan-400 mb-8 flex items-center gap-2">📑 Emissão de NF-e (Modelo 55)</h1>
        
        {/* Bloco 1: Dados da Nota (Cliente e Condição de Pagamento) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-sm font-semibold text-slate-400 mb-2">Selecione o Cliente / Destinatário</label>
            <select 
              value={clienteSelecionado}
              onChange={(e) => setClienteSelecionado(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-cyan-400 transition"
            >
              <option value="">-- Selecione o Cliente --</option>
              {CLIENTES_MOCK.map(c => (
                <option key={c.id} value={c.id}>{c.nome} ({c.documento})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-400 mb-2">Condição de Faturamento / Pagamento</label>
            <select 
              value={condicaoSelecionada}
              onChange={(e) => setCondicaoSelecionada(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-cyan-400 transition"
            >
              <option value="">-- Selecione o Prazo --</option>
              {CONDICOES_MOCK.map(cond => (
                <option key={cond.id} value={cond.id}>{cond.descricao}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Bloco 2: Adicionar Itens */}
        <div className="bg-slate-850 p-6 rounded-xl border border-slate-800 mb-8">
          <label className="block text-sm font-semibold text-slate-400 mb-2">Adicionar Produto à Nota</label>
          <select 
            onChange={(e) => {
              if(e.target.value) {
                adicionarProduto(e.target.value);
                e.target.value = ""; // limpa select
              }
            }}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-cyan-400 transition"
          >
            <option value="">-- Busque pelo produto aqui --</option>
            {PRODUTOS_MOCK.map(p => (
              <option key={p.id} value={p.id}>{p.descricao} - R$ {p.preco.toFixed(2)} (NCM: {p.ncm})</option>
            ))}
          </select>
        </div>

        {/* Bloco 3: Lista de Itens Adicionados */}
        <div className="border border-slate-800 rounded-xl overflow-hidden mb-8">
          <table className="w-full border-collapse text-left text-sm text-slate-300">
            <thead className="bg-slate-800 text-slate-400 uppercase text-xs font-bold">
              <tr>
                <th className="p-4">Item / Produto</th>
                <th className="p-4">NCM</th>
                <th className="p-4 text-center">Qtd</th>
                <th className="p-4 text-right">Preço Unitário</th>
                <th className="p-4 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {carrinho.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">Nenhum produto adicionado à NF-e ainda.</td>
                </tr>
              ) : (
                carrinho.map((item, index) => (
                  <tr key={item.produtoId} className="hover:bg-slate-850 transition">
                    <td className="p-4 font-medium text-white">{index + 1}. {item.descricao}</td>
                    <td className="p-4 text-slate-400">{item.ncm}</td>
                    <td className="p-4 text-center font-semibold">{item.quantidade}</td>
                    <td className="p-4 text-right">R$ {item.preco.toFixed(2)}</td>
                    <td className="p-4 text-right font-bold text-slate-100">R$ {(item.quantidade * item.preco).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé: Totalizadores e Transmissão */}
        <div className="flex flex-col sm:flex-row justify-between items-center border-t border-slate-800 pt-6">
          <div className="text-center sm:text-left mb-4 sm:mb-0">
            <p className="text-sm text-slate-400 uppercase tracking-wider">Valor Total da Nota</p>
            <p className="text-3xl font-black text-emerald-400">R$ {valorTotal.toFixed(2)}</p>
          </div>

          <div className="w-full sm:w-auto">
            {statusNota === 'aberto' && (
              <button
                disabled={!clienteSelecionado || !condicaoSelecionada || carrinho.length === 0}
                onClick={transmitirNFe}
                className="w-full sm:w-64 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-700 text-slate-950 font-extrabold py-4 px-6 rounded-xl shadow-lg shadow-cyan-500/10 transition active:scale-[0.99] cursor-pointer text-center"
              >
                Transmitir NF-e para SEFAZ
              </button>
            )}

            {statusNota === 'processando' && (
              <div className="w-full sm:w-64 bg-slate-800 text-cyan-400 border border-cyan-500/20 text-center py-4 px-6 rounded-xl font-bold animate-pulse">
                ⚙️ Assinando e Transmitindo...
              </div>
            )}

            {statusNota === 'emitida' && (
              <div className="w-full sm:w-72 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-center p-4 rounded-xl font-bold">
                🚀 NF-e Emitida com Sucesso!
                <p className="text-xs text-slate-400 font-normal mt-1">Duplicatas geradas no Contas a Receber.</p>
                <button onClick={() => setStatusNota('aberto')} className="text-xs underline mt-2 block mx-auto text-cyan-400 hover:text-white">Emitir Outra Nota</button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
