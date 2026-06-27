import { useState, useEffect, useRef, useCallback } from 'react';
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
      // Primeiro e ultimo dia do mes atual
      dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      break;
    case 'ano':
      // Ano atual completo
      dataInicio = new Date(hoje.getFullYear(), 0, 1);
      dataFim = new Date(hoje.getFullYear(), 11, 31);
      break;
    default:
      // Default: mes atual
      dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  }

  return {
    data_inicio: dataInicio.toISOString().split('T')[0],
    data_fim: dataFim.toISOString().split('T')[0]
  };
};

/**
 * Componente de filtro de data reutilizável
 * Inclui botões de período rápido (Hoje, 7 Dias, Mês, Ano) e campos de data
 * Pode ser usado de forma controlada (passando initialDataInicio/initialDataFim) ou não-controlada
 */
function DateFilter({
  onFilterChange,
  defaultPeriodo = 'mes',
  showPeriodButtons = true,
  initialDataInicio = null,
  initialDataFim = null
}) {
  // Calcula datas iniciais - usa valores passados ou calcula baseado no periodo
  const defaultDates = getDateRange(defaultPeriodo);
  const [periodo, setPeriodo] = useState(defaultPeriodo);
  const [dataInicio, setDataInicio] = useState(initialDataInicio || defaultDates.data_inicio);
  const [dataFim, setDataFim] = useState(initialDataFim || defaultDates.data_fim);
  const debounceTimer = useRef(null);

  // Sincroniza com valores externos se fornecidos
  useEffect(() => {
    if (initialDataInicio) {
      setDataInicio(initialDataInicio);
    }
  }, [initialDataInicio]);

  useEffect(() => {
    if (initialDataFim) {
      setDataFim(initialDataFim);
    }
  }, [initialDataFim]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const isValidDate = useCallback((value) => {
    if (!value) return false;
    const parsed = Date.parse(value);
    return !isNaN(parsed);
  }, []);

  const emitFilterChange = useCallback((inicio, fim, novoPeriodo) => {
    if (!onFilterChange) return;
    if (!isValidDate(inicio) || !isValidDate(fim)) return;
    if (inicio > fim) return;

    onFilterChange({
      periodo: novoPeriodo,
      data_inicio: inicio,
      data_fim: fim
    });
  }, [onFilterChange, isValidDate]);

  const handlePeriodoChange = (novoPeriodo) => {
    setPeriodo(novoPeriodo);
    const dates = getDateRange(novoPeriodo);
    setDataInicio(dates.data_inicio);
    setDataFim(dates.data_fim);

    emitFilterChange(dates.data_inicio, dates.data_fim, novoPeriodo);
  };

  const handleDataChange = (campo, valor) => {
    setPeriodo('custom');

    let novaDataInicio = dataInicio;
    let novaDataFim = dataFim;

    if (campo === 'inicio') {
      novaDataInicio = valor;
      setDataInicio(valor);
    } else {
      novaDataFim = valor;
      setDataFim(valor);
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      emitFilterChange(novaDataInicio, novaDataFim, 'custom');
    }, 300);
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
          <label htmlFor="date-inicio">De:</label>
          <input
            id="date-inicio"
            type="date"
            value={dataInicio}
            onChange={(e) => handleDataChange('inicio', e.target.value)}
            className="date-input"
          />
        </div>
        <div className="date-input-group">
          <label htmlFor="date-fim">Ate:</label>
          <input
            id="date-fim"
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
