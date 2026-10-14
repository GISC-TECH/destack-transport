import { useState, useEffect, useCallback } from 'react';
import { perfisAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import PageHeader from '../Common/PageHeader';
import Button from '../Common/Button';
import Modal from '../Common/Modal';
import styles from './Perfis.module.css';

const ACOES = [
  { key: 'view', label: 'Ver' },
  { key: 'add', label: 'Criar' },
  { key: 'change', label: 'Editar' },
  { key: 'delete', label: 'Excluir' },
];

function Perfis() {
  const toast = useToast();
  const [perfis, setPerfis] = useState([]);
  const [modulos, setModulos] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [perfilEdicao, setPerfilEdicao] = useState(null);
  const [permissoesEdicao, setPermissoesEdicao] = useState({});
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [perfisRes, modulosRes] = await Promise.all([
        perfisAPI.list(),
        perfisAPI.getModulos(),
      ]);
      setPerfis(perfisRes.perfis || []);
      setModulos(modulosRes.modulos || {});
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar perfis');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEditar = async (perfil) => {
    try {
      const data = await perfisAPI.get(perfil.nome);
      const permissoes = {};
      (data.modulos || []).forEach((mod) => {
        permissoes[mod.key] = {
          view: mod.acoes.includes('view'),
          add: mod.acoes.includes('add'),
          change: mod.acoes.includes('change'),
          delete: mod.acoes.includes('delete'),
        };
      });
      setPermissoesEdicao(permissoes);
      setPerfilEdicao({ ...perfil, descricao: data.descricao });
    } catch (err) {
      toast.error(err.message || 'Erro ao abrir perfil');
    }
  };

  const toggleAcao = (modulo, acao) => {
    setPermissoesEdicao((prev) => ({
      ...prev,
      [modulo]: {
        ...prev[modulo],
        [acao]: !prev[modulo]?.[acao],
      },
    }));
  };

  const handleSalvar = async () => {
    if (!perfilEdicao) return;

    const modulosPayload = {};
    Object.entries(permissoesEdicao).forEach(([modulo, acoes]) => {
      const selecionadas = Object.entries(acoes)
        .filter(([, ativo]) => ativo)
        .map(([acao]) => acao);
      if (selecionadas.length > 0) {
        modulosPayload[modulo] = selecionadas;
      }
    });

    try {
      setSaving(true);
      await perfisAPI.update(perfilEdicao.nome, { modulos: modulosPayload });
      toast.success(`Perfil "${perfilEdicao.nome}" atualizado com sucesso!`);
      setPerfilEdicao(null);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleSincronizar = async () => {
    try {
      setLoading(true);
      await perfisAPI.sincronizar();
      toast.success('Perfis sincronizados com sucesso!');
      setShowSyncConfirm(false);
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Erro ao sincronizar perfis');
    } finally {
      setLoading(false);
    }
  };

  if (loading && perfis.length === 0) {
    return <Loading message="Carregando perfis..." />;
  }

  return (
    <div className={styles.perfisPage}>
      <PageHeader
        title="Perfis de Permissões"
        subtitle="Gerencie o que cada perfil pode visualizar e alterar no sistema"
        icon={(
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        )}
        actions={(
          <Button variant="outline" onClick={() => setShowSyncConfirm(true)} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
            </svg>
            Sincronizar Padrão
          </Button>
        )}
      />

      <div className={styles.perfisGrid}>
        {perfis.map((perfil) => (
          <div key={perfil.nome} className={styles.perfilCard}>
            <div className={styles.perfilHeader}>
              <h3 className={styles.perfilNome}>{perfil.nome}</h3>
              <span className={styles.perfilCount}>
                {perfil.total_permissoes} permissões
              </span>
            </div>
            <p className={styles.perfilDescricao}>{perfil.descricao}</p>
            <div className={styles.perfilActions}>
              <Button variant="primary" size="sm" onClick={() => handleEditar(perfil)}>
                Editar Permissões
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={!!perfilEdicao}
        onClose={() => setPerfilEdicao(null)}
        title={perfilEdicao ? `Editar: ${perfilEdicao.nome}` : ''}
        size="lg"
        footer={(
          <>
            <Button variant="outline" onClick={() => setPerfilEdicao(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSalvar} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </>
        )}
      >
        {perfilEdicao && (
          <div className={styles.modalContent}>
            <p className={styles.modalHint}>
              Marque as ações permitidas para cada módulo. Desmarque todas para ocultar o módulo desse perfil.
            </p>
            <div className={styles.modulosList}>
              {Object.entries(modulos).map(([key, info]) => (
                <div key={key} className={styles.moduloRow}>
                  <div className={styles.moduloInfo}>
                    <span className={styles.moduloLabel}>{info.label}</span>
                  </div>
                  <div className={styles.moduloActions}>
                    {ACOES.map((acao) => {
                      const infoAcoes = info.acoes_padrao || ['view', 'add', 'change', 'delete'];
                      if (!infoAcoes.includes(acao.key)) return null;
                      const backupRestrito = key === 'backup' && perfilEdicao.nome !== 'Administrativo';
                      return (
                        <label
                          key={acao.key}
                          className={styles.acaoCheck}
                          title={backupRestrito ? 'Backup e restrito ao perfil Administrativo.' : undefined}
                        >
                          <input
                            type="checkbox"
                            checked={!!permissoesEdicao[key]?.[acao.key]}
                            onChange={() => toggleAcao(key, acao.key)}
                            disabled={saving || backupRestrito}
                          />
                          <span>{acao.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showSyncConfirm}
        onClose={loading ? undefined : () => setShowSyncConfirm(false)}
        closeOnOverlayClick={!loading}
        title="Sincronizar perfis padrão"
        size="sm"
        footer={(
          <div className={styles.confirmActions}>
            <Button variant="outline" onClick={() => setShowSyncConfirm(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button variant="warning" onClick={handleSincronizar} loading={loading}>
              Sincronizar
            </Button>
          </div>
        )}
      >
        <p className={styles.confirmText}>
          Os perfis Leitura, Operacional, Financeiro e Administrativo serão recriados a partir do padrão do sistema.
          Usuários no modo personalizado não serão alterados.
        </p>
      </Modal>
    </div>
  );
}

export default Perfis;
