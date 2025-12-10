import { useState, useEffect } from 'react';
import './DateFilter.css';

// Funcao para calcular datas baseadas no periodo (fora do componente)
const getDateRange = (periodo) => {
  const hoje = new Date();
  let dataInicio, dataFim;

  switch (periodo) {
    case 'hoje':
      dataInicio = new Date(hoje);
      dataFim = new Date(hoje);
      break;
    case '7dias':
      dataFim = new Date(hoje);
      dataInicio = new Date(hoje);
      dataInicio.setDate(dataInicio.getDate() - 7);
      break;
    case 'mes':
      // Usa o ultimo mes com dados (setembro 2025) se estamos alem dessa data
      // Fallback para mes atual se estivermos antes
      const mesAtualInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const ultimoMesComDados = new Date(2025, 8, 1); // Setembro 2025
      if (mesAtualInicio > ultimoMesComDados) {
        // Se mes atual nao tem dados, usa setembro 2025
        dataInicio = new Date(2025, 8, 1);
        dataFim = new Date(2025, 8, 30);
      } else {
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      }
      break;
    case 'ano':
      // Usa 2025 completo para ter todos os dados
      dataInicio = new Date(2025, 0, 1);
      dataFim = new Date(2025, 11, 31);
      break;
    default:
      // Default: ultimo ano com dados (2025)
      dataInicio = new Date(2025, 0, 1);
      dataFim = new Date(2025, 8, 30);
  }

  return {
    data_inicio: dataInicio.toISOString().split('T')[0],
    data_fim: dataFim.toISOString().split('T')[0]
  };
};

/**
 * Componente de filtro de data reutilizável
 * Inclui botões de período rápido (Hoje, 7 Dias, Mês, Ano) e campos de data
 */
function DateFilter({ onFilterChange, defaultPeriodo = 'mes', showPeriodButtons = true }) {
  // Calcula datas iniciais apenas uma vez usando função no useState
  const [periodo, setPeriodo] = useState(defaultPeriodo);
  const [dataInicio, setDataInicio] = useState(() => getDateRange(defaultPeriodo).data_inicio);
  const [dataFim, setDataFim] = useState(() => getDateRange(defaultPeriodo).data_fim);

  // NÃO notifica o componente pai na montagem inicial
  // Os componentes já carregam os dados no seu próprio useEffect
  // O DateFilter só notifica quando o usuário INTERAGE (clica nos botões ou muda as datas)

  const handlePeriodoChange = (novoPeriodo) => {
    setPeriodo(novoPeriodo);
    const dates = getDateRange(novoPeriodo);
    setDataInicio(dates.data_inicio);
    setDataFim(dates.data_fim);

    if (onFilterChange) {
      onFilterChange({
        periodo: novoPeriodo,
        data_inicio: dates.data_inicio,
        data_fim: dates.data_fim
      });
    }
  };

  const handleDataChange = (campo, valor) => {
    setPeriodo('custom');

    if (campo === 'inicio') {
      setDataInicio(valor);
      if (onFilterChange) {
        onFilterChange({
          periodo: 'custom',
          data_inicio: valor,
          data_fim: dataFim
        });
      }
    } else {
      setDataFim(valor);
      if (onFilterChange) {
        onFilterChange({
          periodo: 'custom',
          data_inicio: dataInicio,
          data_fim: valor
        });
      }
    }
  };

  return (
    <div className="date-filter">
      {showPeriodButtons && (
        <div className="period-buttons">
          <button
            type="button"
            className={`period-btn ${periodo === 'hoje' ? 'active' : ''}`}
            onClick={() => handlePeriodoChange('hoje')}
          >
            Hoje
          </button>
          <button
            type="button"
            className={`period-btn ${periodo === '7dias' ? 'active' : ''}`}
            onClick={() => handlePeriodoChange('7dias')}
          >
            7 Dias
          </button>
          <button
            type="button"
            className={`period-btn ${periodo === 'mes' ? 'active' : ''}`}
            onClick={() => handlePeriodoChange('mes')}
          >
            Mes
          </button>
          <button
            type="button"
            className={`period-btn ${periodo === 'ano' ? 'active' : ''}`}
            onClick={() => handlePeriodoChange('ano')}
          >
            Ano
          </button>
        </div>
      )}

      <div className="date-inputs">
        <div className="date-input-group">
          <label>De:</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => handleDataChange('inicio', e.target.value)}
            className="date-input"
          />
        </div>
        <div className="date-input-group">
          <label>Ate:</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => handleDataChange('fim', e.target.value)}
            className="date-input"
          />
        </div>
      </div>
    </div>
  );
}

export default DateFilter;
