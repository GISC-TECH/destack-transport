import { useState, useEffect } from 'react';
import { comunicacaoAPI, clientesAPI, motoristasAPI, ordemViagemAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import './ComunicacaoPanel.css';

function ComunicacaoPanel() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [ordens, setOrdens] = useState([]);

  const [form, setForm] = useState({
    canal: 'email',
    destinatario: '',
    assunto: '',
    conteudo: '',
    cliente_id: '',
    motorista_id: '',
    ordem_id: ''
  });

  useEffect(() => {
    loadOptions();
    loadHistorico();
  }, []);

  const loadOptions = async () => {
    try {
      const [cRes, mRes, oRes] = await Promise.all([
        clientesAPI.list({ ativo: true }),
        motoristasAPI.list({ ativo: true }),
        ordemViagemAPI.list({ limit: 100 })
      ]);
      setClientes(cRes.results || cRes);
      setMotoristas(mRes.results || mRes);
      setOrdens(oRes.results || oRes);
    } catch (err) {
      console.error('Erro ao carregar opções:', err);
    }
  };

  const loadHistorico = async () => {
    try {
      setLoading(true);
      const result = await comunicacaoAPI.list();
      setHistorico(result.results || result);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const preencherDestinatario = () => {
    if (form.cliente_id) {
      const cliente = clientes.find(c => String(c.id) === form.cliente_id);
      if (cliente?.email) {
        setForm(prev => ({ ...prev, destinatario: cliente.email }));
        return;
      }
    }
    if (form.motorista_id) {
      const motorista = motoristas.find(m => String(m.id) === form.motorista_id);
      if (motorista?.email || motorista?.telefone) {
        setForm(prev => ({
          ...prev,
          destinatario: form.canal === 'email' ? (motorista.email || '') : (motorista.telefone || '')
        }));
      }
    }
  };

  useEffect(() => {
    preencherDestinatario();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.cliente_id, form.motorista_id, form.canal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = {
        ...form,
        cliente_id: form.cliente_id || undefined,
        motorista_id: form.motorista_id || undefined,
        ordem_id: form.ordem_id || undefined,
      };
      await comunicacaoAPI.enviar(payload);
      toast.success('Comunicação enviada com sucesso!');
      setForm({
        canal: 'email',
        destinatario: '',
        assunto: '',
        conteudo: '',
        cliente_id: '',
        motorista_id: '',
        ordem_id: ''
      });
      loadHistorico();
    } catch (err) {
      toast.error(err.message || 'Erro ao enviar comunicação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="comunicacao-page">
      <div className="page-header">
        <div className="header-title">
          <h1>Comunicação</h1>
          <p>Envie e-mails e registre mensagens para clientes e motoristas</p>
        </div>
      </div>

      <div className="comunicacao-grid">
        <div className="comunicacao-card">
          <h3>Nova Mensagem</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Canal</label>
                <select name="canal" value={form.canal} onChange={handleChange}>
                  <option value="email">E-mail</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Destinatário</label>
                <input
                  type="text"
                  name="destinatario"
                  value={form.destinatario}
                  onChange={handleChange}
                  placeholder={form.canal === 'email' ? 'email@exemplo.com' : '5511999999999'}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Cliente</label>
                <select name="cliente_id" value={form.cliente_id} onChange={handleChange}>
                  <option value="">Selecione</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.razao_social}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Motorista</label>
                <select name="motorista_id" value={form.motorista_id} onChange={handleChange}>
                  <option value="">Selecione</option>
                  {motoristas.map(m => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Ordem de Viagem</label>
                <select name="ordem_id" value={form.ordem_id} onChange={handleChange}>
                  <option value="">Selecione</option>
                  {ordens.map(o => (
                    <option key={o.id} value={o.id}>{o.numero}</option>
                  ))}
                </select>
              </div>
            </div>

            {form.canal === 'email' && (
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Assunto</label>
                  <input
                    type="text"
                    name="assunto"
                    value={form.assunto}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label>Mensagem</label>
                <textarea
                  name="conteudo"
                  value={form.conteudo}
                  onChange={handleChange}
                  rows={6}
                  required
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </form>
        </div>

        <div className="comunicacao-card">
          <h3>Histórico</h3>
          {loading && historico.length === 0 ? (
            <Loading message="Carregando..." />
          ) : historico.length === 0 ? (
            <p className="empty-text">Nenhuma comunicação registrada.</p>
          ) : (
            <div className="historico-list">
              {historico.map(item => (
                <div key={item.id} className={`historico-item status-${item.status}`}>
                  <div className="historico-header">
                    <span className="historico-canal">{item.canal.toUpperCase()}</span>
                    <span className="historico-status">{item.status}</span>
                  </div>
                  <div className="historico-destinatario">{item.destinatario}</div>
                  {item.assunto && <div className="historico-assunto">{item.assunto}</div>}
                  <div className="historico-conteudo">{item.conteudo}</div>
                  <div className="historico-meta">
                    {item.cliente_nome && <span>Cliente: {item.cliente_nome}</span>}
                    {item.motorista_nome && <span>Motorista: {item.motorista_nome}</span>}
                    {item.ordem_numero && <span>OS: {item.ordem_numero}</span>}
                    <span>{new Date(item.criado_em).toLocaleString('pt-BR')}</span>
                  </div>
                  {item.erro && <div className="historico-erro">{item.erro}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ComunicacaoPanel;
