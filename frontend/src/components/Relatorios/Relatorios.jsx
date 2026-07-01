import { useState, useCallback } from 'react';
import { relatoriosAPI } from '../../services/api';
import PageHeader from '../Common/PageHeader';
import DateFilter from '../Common/DateFilter';
import Button from '../Common/Button';
import styles from './Relatorios.module.css';

function Relatorios() {
  const [tipoRelatorio, setTipoRelatorio] = useState('');
  const [formato, setFormato] = useState('pdf');
  const [filtros, setFiltros] = useState({
    data_inicio: '',
    data_fim: '',
    status: '',
    modalidade: '',
    placa: '',
    condutor: '',
    tipo: '',
    ativo: '',
    pendentes: '',
    incluir_cancelados: '',
    encerrado: ''
  });
  const [gerando, setGerando] = useState(false);
  const [error, setError] = useState(null);
  const [sucesso, setSucesso] = useState(null);

  const handleDateFilterChange = useCallback((newFiltros) => {
    setFiltros(prev => ({
      ...prev,
      data_inicio: newFiltros.data_inicio,
      data_fim: newFiltros.data_fim
    }));
  }, []);

  const handleFiltroChange = useCallback((campo, valor) => {
    setFiltros(prev => ({ ...prev, [campo]: valor }));
  }, []);

  // Tipos de relatorios suportados pelo backend (RelatorioAPIView)
  const relatoriosDisponiveis = [
    {
      id: 'ctes',
      nome: 'CT-es Emitidos',
      descricao: 'Relatorio de todos os CT-es emitidos no periodo',
      icon: 'file-text'
    },
    {
      id: 'mdfes',
      nome: 'MDF-es Emitidos',
      descricao: 'Relatorio de manifestos de documentos fiscais',
      icon: 'truck'
    },
    {
      id: 'faturamento',
      nome: 'Faturamento',
      descricao: 'Relatorio financeiro com faturamento por mes',
      icon: 'dollar-sign'
    },
    {
      id: 'pagamentos',
      nome: 'Pagamentos',
      descricao: 'Relatorio de pagamentos a agregados e proprios',
      icon: 'credit-card'
    },
    {
      id: 'veiculos',
      nome: 'Veículos',
      descricao: 'Relatorio da frota de veiculos cadastrados',
      icon: 'truck'
    },
    {
      id: 'manutencoes',
      nome: 'Manutencoes',
      descricao: 'Relatorio de manutencoes realizadas e agendadas',
      icon: 'tool'
    },
    {
      id: 'km_rodado',
      nome: 'KM Rodado',
      descricao: 'Relatorio de quilometragem por veiculo',
      icon: 'compass'
    },
    {
      id: 'motoristas',
      nome: 'Motoristas',
      descricao: 'Cadastro, viagens, repasses e validades (CNH/NR/MOPP/ASO) vencendo',
      icon: 'user'
    }
  ];

  // Configuração de filtros específicos por tipo de relatório
  const filtrosPorTipo = {
    ctes: [
      { campo: 'status', label: 'Status', tipo: 'select', opcoes: [
        { value: '', label: 'Todos' },
        { value: 'autorizado', label: 'Autorizado' },
        { value: 'cancelado', label: 'Cancelado' },
        { value: 'encerrado', label: 'Encerrado' },
        { value: 'denegado', label: 'Denegado' },
        { value: 'inutilizado', label: 'Inutilizado' }
      ]},
      { campo: 'modalidade', label: 'Modalidade', tipo: 'select', opcoes: [
        { value: '', label: 'Todas' },
        { value: 'CIF', label: 'CIF' },
        { value: 'FOB', label: 'FOB' }
      ]},
      { campo: 'placa', label: 'Placa', tipo: 'text', placeholder: 'Ex: ABC1D23' },
      { campo: 'condutor', label: 'Condutor', tipo: 'text', placeholder: 'Nome do condutor' },
      { campo: 'incluir_cancelados', label: 'Incluir cancelados', tipo: 'select', opcoes: [
        { value: '', label: 'Não' },
        { value: '1', label: 'Sim' }
      ]}
    ],
    mdfes: [
      { campo: 'status', label: 'Status', tipo: 'select', opcoes: [
        { value: '', label: 'Todos' },
        { value: 'autorizado', label: 'Autorizado' },
        { value: 'cancelado', label: 'Cancelado' },
        { value: 'encerrado', label: 'Encerrado' },
        { value: 'denegado', label: 'Denegado' },
        { value: 'inutilizado', label: 'Inutilizado' }
      ]},
      { campo: 'placa', label: 'Placa', tipo: 'text', placeholder: 'Ex: ABC1D23' },
      { campo: 'condutor', label: 'Condutor', tipo: 'text', placeholder: 'Nome do condutor' },
      { campo: 'encerrado', label: 'Encerrado', tipo: 'select', opcoes: [
        { value: '', label: 'Todos' },
        { value: 'true', label: 'Sim' },
        { value: 'false', label: 'Não' }
      ]}
    ],
    pagamentos: [
      { campo: 'tipo', label: 'Tipo', tipo: 'select', opcoes: [
        { value: '', label: 'Todos' },
        { value: 'agregado', label: 'Agregado' },
        { value: 'proprio', label: 'Próprio' }
      ]},
      { campo: 'status', label: 'Status', tipo: 'select', opcoes: [
        { value: '', label: 'Todos' },
        { value: 'pendente', label: 'Pendente' },
        { value: 'pago', label: 'Pago' }
      ]},
      { campo: 'placa', label: 'Placa', tipo: 'text', placeholder: 'Ex: ABC1D23' },
      { campo: 'condutor', label: 'Condutor', tipo: 'text', placeholder: 'Nome do condutor' }
    ],
    veiculos: [
      { campo: 'ativo', label: 'Ativo', tipo: 'select', opcoes: [
        { value: '', label: 'Todos' },
        { value: 'true', label: 'Sim' },
        { value: 'false', label: 'Não' }
      ]},
      { campo: 'placa', label: 'Placa', tipo: 'text', placeholder: 'Ex: ABC1D23' }
    ],
    manutencoes: [
      { campo: 'status', label: 'Status', tipo: 'select', opcoes: [
        { value: '', label: 'Todos' },
        { value: 'agendada', label: 'Agendada' },
        { value: 'em_andamento', label: 'Em Andamento' },
        { value: 'concluida', label: 'Concluída' },
        { value: 'cancelada', label: 'Cancelada' }
      ]},
      { campo: 'tipo', label: 'Tipo', tipo: 'select', opcoes: [
        { value: '', label: 'Todos' },
        { value: 'preventiva', label: 'Preventiva' },
        { value: 'corretiva', label: 'Corretiva' },
        { value: 'preditiva', label: 'Preditiva' }
      ]},
      { campo: 'placa', label: 'Placa', tipo: 'text', placeholder: 'Ex: ABC1D23' }
    ],
    km_rodado: [
      { campo: 'placa', label: 'Placa', tipo: 'text', placeholder: 'Ex: ABC1D23' }
    ],
    motoristas: [
      { campo: 'ativo', label: 'Ativo', tipo: 'select', opcoes: [
        { value: '', label: 'Todos' },
        { value: 'true', label: 'Sim' },
        { value: 'false', label: 'Não' }
      ]},
      { campo: 'pendentes', label: 'Somente pendentes', tipo: 'select', opcoes: [
        { value: '', label: 'Não' },
        { value: '1', label: 'Sim' }
      ]}
    ]
  };

  const handleGerarRelatorio = async () => {
    if (!tipoRelatorio) {
      setError('Selecione um tipo de relatorio');
      return;
    }

    try {
      setGerando(true);
      setError(null);
      setSucesso(null);

      const params = {
        tipo: tipoRelatorio,
        formato,
        ...filtros
      };

      // Remove parametros vazios
      Object.keys(params).forEach(key => !params[key] && delete params[key]);

      const response = await relatoriosAPI.gerar(params);

      // Se retornar um blob, fazer download
      if (response instanceof Blob) {
        // Verifica se o blob tem conteudo
        if (response.size === 0) {
          setError('Nenhum dado encontrado para os filtros selecionados');
          return;
        }

        const url = window.URL.createObjectURL(response);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio_${tipoRelatorio}_${new Date().toISOString().split('T')[0]}.${formato}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        setSucesso(`Relatorio ${tipoRelatorio.toUpperCase()} gerado com sucesso!`);
      } else if (Array.isArray(response)) {
        // Se for JSON (array de dados), cria download como JSON
        const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio_${tipoRelatorio}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        setSucesso(`Relatorio ${tipoRelatorio.toUpperCase()} gerado com ${response.length} registros!`);
      } else if (response && response.message) {
        // Mensagem do servidor
        setSucesso(response.message);
      }
    } catch (err) {
      setError(err.message || 'Erro ao gerar relatorio');
    } finally {
      setGerando(false);
    }
  };

  const getIcon = (iconName) => {
    const icons = {
      'file-text': (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
      ),
      'truck': (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="1" y="3" width="15" height="13"></rect>
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
          <circle cx="5.5" cy="18.5" r="2.5"></circle>
          <circle cx="18.5" cy="18.5" r="2.5"></circle>
        </svg>
      ),
      'dollar-sign': (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23"></line>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
      ),
      'credit-card': (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
          <line x1="1" y1="10" x2="23" y2="10"></line>
        </svg>
      ),
      'users': (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      ),
      'user': (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      ),
      'tool': (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
        </svg>
      ),
      'compass': (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
        </svg>
      )
    };
    return icons[iconName] || icons['file-text'];
  };

  const relatorioIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  );

  const renderFiltro = (config) => {
    const { campo, label, tipo, opcoes, placeholder } = config;
    const inputId = `filtro_${campo}`;

    if (tipo === 'select') {
      return (
        <div key={campo} className={styles.formGroup}>
          <label htmlFor={inputId}>{label}</label>
          <select
            id={inputId}
            value={filtros[campo] || ''}
            onChange={(e) => handleFiltroChange(campo, e.target.value)}
          >
            {opcoes.map(op => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div key={campo} className={styles.formGroup}>
        <label htmlFor={inputId}>{label}</label>
        <input
          id={inputId}
          type="text"
          value={filtros[campo] || ''}
          placeholder={placeholder || ''}
          onChange={(e) => handleFiltroChange(campo, e.target.value)}
        />
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Relatórios"
        subtitle="Gere relatórios personalizados do sistema"
        icon={relatorioIcon}
        breadcrumbs={[{ label: 'Relatórios' }]}
      />

      <div className={styles.container}>
        {/* Seleção de Relatório */}
        <div className={styles.grid}>
          {relatoriosDisponiveis.map((rel) => (
            <div
              key={rel.id}
              role="button"
              tabIndex={0}
              aria-pressed={tipoRelatorio === rel.id}
              aria-label={`Selecionar relatório ${rel.nome}`}
              className={`${styles.card} ${tipoRelatorio === rel.id ? styles.cardSelected : ''}`}
              onClick={() => setTipoRelatorio(rel.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setTipoRelatorio(rel.id);
                }
              }}
            >
              <div className={styles.icon}>
                {getIcon(rel.icon)}
              </div>
              <div className={styles.info}>
                <h3>{rel.nome}</h3>
                <p>{rel.descricao}</p>
              </div>
              {tipoRelatorio === rel.id && (
                <div className={styles.selectedCheck} aria-hidden="true">✓</div>
              )}
            </div>
          ))}
        </div>

        {/* Filtros */}
        {tipoRelatorio && (
          <div className={styles.filtros}>
            <h3>Filtros do Relatório</h3>
            <div className={styles.filtrosGrid}>
              <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                <DateFilter
                  onFilterChange={handleDateFilterChange}
                  defaultPeriodo="mes"
                  variant="flat"
                />
              </div>
              {filtrosPorTipo[tipoRelatorio]?.map(renderFiltro)}
              <div className={styles.formGroup}>
                <label htmlFor="formato">Formato</label>
                <select
                  id="formato"
                  value={formato}
                  onChange={(e) => setFormato(e.target.value)}
                >
                  <option value="pdf">PDF</option>
                  <option value="xlsx">Excel (XLSX)</option>
                  <option value="csv">CSV</option>
                </select>
              </div>
            </div>

            {error && (
              <div className={styles.errorMessage} role="alert" aria-live="polite">{error}</div>
            )}

            {sucesso && (
              <div className={styles.successMessage} role="status" aria-live="polite">{sucesso}</div>
            )}

            <div className={styles.actions}>
              <Button
                size="lg"
                loading={gerando}
                disabled={gerando}
                onClick={handleGerarRelatorio}
              >
                {!gerando && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                )}
                Gerar Relatório
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Relatorios;
