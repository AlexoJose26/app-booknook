import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  StatusBar,
  Platform,
} from "react-native";
import { useThemeCustom } from "@/contexts/ThemeContext";
import { db } from "@/database/db";
import { usuarios, livros, publicacoes } from "@/database/schema";
import * as ImagePicker from "expo-image-picker";
import { eq } from "drizzle-orm";

type Usuario = {
  id: string;
  nome: string;
  foto_perfil?: string;
};

export default function Perfil() {
  const { colors } = useThemeCustom();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [aba, setAba] = useState<"publicacoes" | "lidos">("publicacoes");
  const [publicacoesUsuario, setPublicacoesUsuario] = useState<any[]>([]);
  const [livrosLidos, setLivrosLidos] = useState<any[]>([]);
  const [fotoLocal, setFotoLocal] = useState<string | null>(null); // Para exibir a foto local imediatamente

  // Pegar usuário do banco
  const carregarUsuario = async () => {
    try {
      const res = await db.select().from(usuarios).limit(1); // Ajuste para usuário logado
      if (res.length > 0) {
        setUsuario(res[0]);
        setNovoNome(res[0].nome);
        setFotoLocal(res[0].foto_perfil || null);
      }
    } catch (error) {
      console.log("Erro ao carregar usuário:", error);
    }
  };

  // Pegar publicações e livros lidos
  const carregarDados = async () => {
    if (!usuario) return;
    try {
      const pubs = await db
        .select()
        .from(publicacoes)
        .where(eq(publicacoes.usuarioId, usuario.id));
      setPublicacoesUsuario(pubs);

      const lidos = await db
        .select()
        .from(livros)
        .where(eq(livros.lidoPor, usuario.id));
      setLivrosLidos(lidos);
    } catch (error) {
      console.log("Erro ao carregar dados:", error);
    }
  };

  useEffect(() => {
    carregarUsuario();
  }, []);

  useEffect(() => {
    carregarDados();
  }, [usuario]);

  // Trocar foto
  const trocarFoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setFotoLocal(uri); // Atualiza imediatamente a foto na tela
      try {
        await db
          .update(usuarios)
          .set({ foto_perfil: uri })
          .where(eq(usuarios.id, usuario!.id));
        carregarUsuario();
      } catch (error) {
        console.log("Erro ao atualizar foto:", error);
      }
    }
  };

  // Editar nome
  const salvarNome = async () => {
    if (!novoNome.trim()) return;
    try {
      await db.update(usuarios).set({ nome: novoNome }).where(eq(usuarios.id, usuario!.id));
      setEditModalVisible(false);
      carregarUsuario();
      Alert.alert("Sucesso", "Nome atualizado!");
    } catch (error) {
      console.log("Erro ao atualizar nome:", error);
    }
  };

  // Terminar sessão
  const terminarSessao = () => {
    Alert.alert("Terminar sessão", "Deseja realmente sair?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sim", onPress: () => console.log("Sessão encerrada") },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={colors.background === "#F9FAFB" ? "dark-content" : "light-content"}
        backgroundColor={colors.background}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.titulo, { color: colors.text }]}>Perfil</Text>
        <TouchableOpacity onPress={() => setMenuVisible(true)}>
          <Text style={{ fontSize: 24, color: colors.text }}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* Menu */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPressOut={() => setMenuVisible(false)}
        >
          <View style={[styles.menu, { backgroundColor: colors.card }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                setEditModalVisible(true);
              }}
            >
              <Text style={{ color: colors.text }}>Editar Perfil</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                terminarSessao();
              }}
            >
              <Text style={{ color: colors.text }}>Terminar Sessão</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.editModalContainer}>
          <View style={[styles.editModal, { backgroundColor: colors.card }]}>
            <Text style={{ color: colors.text, fontWeight: "bold", marginBottom: 10 }}>
              Editar Nome
            </Text>
            <TextInput
              value={novoNome}
              onChangeText={setNovoNome}
              style={[styles.input, { color: colors.text, borderColor: colors.placeholder }]}
              placeholder="Digite seu nome"
              placeholderTextColor={colors.placeholder}
            />
            <TouchableOpacity
              style={[styles.botao, { backgroundColor: colors.button }]}
              onPress={salvarNome}
            >
              <Text style={{ color: colors.buttonText }}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Perfil */}
      <View style={styles.perfilContainer}>
        <TouchableOpacity onPress={trocarFoto}>
          <Image
            source={{
              uri:
                fotoLocal ||
                "https://www.pngitem.com/pimgs/m/146-1468479_my-profile-icon-blank-profile-picture-circle-hd.png",
            }}
            style={styles.fotoPerfil}
          />
        </TouchableOpacity>
        <Text style={[styles.nomeUsuario, { color: colors.text }]}>{usuario?.nome}</Text>
      </View>

      {/* Abas */}
      <View style={{ marginTop: 30, flexDirection: "row" }}>
        <TouchableOpacity
          style={[
            styles.aba,
            aba === "publicacoes" && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setAba("publicacoes")}
        >
          <Text style={{ color: colors.text }}>Publicações</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.aba,
            aba === "lidos" && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setAba("lidos")}
        >
          <Text style={{ color: colors.text }}>Livros Lidos</Text>
        </TouchableOpacity>
      </View>

      {/* Conteúdo das abas */}
      {aba === "publicacoes" ? (
        <FlatList
          data={publicacoesUsuario}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 10, paddingBottom: 50 }}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={{ color: colors.text }}>{item.texto}</Text>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={livrosLidos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 10, paddingBottom: 50 }}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={{ color: colors.text, fontWeight: "bold" }}>{item.titulo}</Text>
              <Text style={{ color: colors.text }}>{item.autor}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 25 : 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  titulo: {
    fontSize: 22,
    fontWeight: "bold",
  },
  perfilContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
  },
  fotoPerfil: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 15,
  },
  nomeUsuario: {
    fontSize: 20,
    fontWeight: "bold",
  },
  aba: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
  card: {
    padding: 15,
    borderRadius: 8,
    marginVertical: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-end",
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingTop: 50,
    paddingRight: 10,
  },
  menu: {
    borderRadius: 8,
    paddingVertical: 5,
    width: 150,
  },
  menuItem: {
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  editModalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  editModal: {
    width: "80%",
    borderRadius: 10,
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
  },
  botao: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
});
