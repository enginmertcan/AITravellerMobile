import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { FirebaseService } from '../services/firebase.service';
import { TripComment } from '../types/travel';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

interface TripCommentsProps {
  travelPlanId: string;
}

const TripComments: React.FC<TripCommentsProps> = ({ travelPlanId }) => {
  const { userId } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const [comments, setComments] = useState<TripComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Yorumları yükle
  useEffect(() => {
    loadComments();
  }, [travelPlanId]);

  const loadComments = async () => {
    if (!travelPlanId) return;

    setLoading(true);
    try {
      const commentsData = await FirebaseService.Comment.getCommentsByTravelPlanId(travelPlanId);
      setComments(commentsData);
    } catch (error) {
      console.error('Yorumları yükleme hatası:', error);
      Alert.alert('Hata', 'Yorumlar yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Yeni yorum ekle
  const handleAddComment = async () => {
    if (!newComment.trim() || !userId || !isUserLoaded || !user) return;

    setSubmitting(true);
    try {
      const commentData: Omit<TripComment, 'id' | 'createdAt' | 'updatedAt'> = {
        travelPlanId,
        userId,
        userName: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Misafir',
        userPhotoUrl: user.imageUrl || undefined,
        content: newComment.trim(),
      };

      await FirebaseService.Comment.addComment(commentData);
      setNewComment('');
      await loadComments(); // Yorumları yeniden yükle
    } catch (error) {
      console.error('Yorum ekleme hatası:', error);
      Alert.alert('Hata', 'Yorum eklenirken bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  // Yorumu düzenlemeye başla
  const startEditing = (comment: TripComment) => {
    setEditingComment(comment.id);
    setEditText(comment.content);
  };

  // Yorumu güncelle
  const handleUpdateComment = async (commentId: string) => {
    if (!editText.trim()) return;

    setSubmitting(true);
    try {
      await FirebaseService.Comment.updateComment(commentId, {
        content: editText.trim(),
      });
      setEditingComment(null);
      await loadComments(); // Yorumları yeniden yükle
    } catch (error) {
      console.error('Yorum güncelleme hatası:', error);
      Alert.alert('Hata', 'Yorum güncellenirken bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  // Yorumu sil
  const handleDeleteComment = async (commentId: string) => {
    Alert.alert(
      'Yorumu Sil',
      'Bu yorumu silmek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              await FirebaseService.Comment.deleteComment(commentId);
              await loadComments(); // Yorumları yeniden yükle
            } catch (error) {
              console.error('Yorum silme hatası:', error);
              Alert.alert('Hata', 'Yorum silinirken bir hata oluştu.');
            } finally {
              setSubmitting(false);
            }
          }
        }
      ]
    );
  };

  // Tarih formatı
  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: tr
      });
    } catch (error) {
      return 'bilinmeyen tarih';
    }
  };

  // Yorum öğesi
  const renderCommentItem = ({ item }: { item: TripComment }) => {
    const isCurrentUser = userId === item.userId;

    return (
      <View style={styles.commentItem}>
        <View style={styles.commentHeader}>
          <Text style={styles.userName}>{item.userName}</Text>
          <Text style={styles.commentDate}>{formatDate(item.createdAt)}</Text>
        </View>

        {editingComment === item.id ? (
          <View style={styles.editContainer}>
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              multiline
            />
            <View style={styles.editButtons}>
              <TouchableOpacity
                style={[styles.editButton, styles.cancelButton]}
                onPress={() => setEditingComment(null)}
              >
                <Text style={styles.editButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editButton, styles.saveButton]}
                onPress={() => handleUpdateComment(item.id)}
                disabled={submitting}
              >
                <Text style={styles.editButtonText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={styles.commentContent}>{item.content}</Text>
        )}

        {isCurrentUser && editingComment !== item.id && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => startEditing(item)}
            >
              <Ionicons name="pencil" size={16} color="#555" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeleteComment(item.id)}
            >
              <Ionicons name="trash" size={16} color="#d9534f" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Yorumlar</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#0066cc" style={styles.loader} />
      ) : (
        <>
          {comments.length > 0 ? (
            <FlatList
              data={comments}
              renderItem={renderCommentItem}
              keyExtractor={(item) => item.id}
              style={styles.commentsList}
              nestedScrollEnabled={true}
            />
          ) : (
            <Text style={styles.noComments}>Henüz yorum yapılmamış. İlk yorumu siz yapın!</Text>
          )}
        </>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Yorum yazın..."
          value={newComment}
          onChangeText={setNewComment}
          multiline
        />
        <TouchableOpacity
          style={[styles.submitButton, (!newComment.trim() || submitting) && styles.disabledButton]}
          onPress={handleAddComment}
          disabled={!newComment.trim() || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  loader: {
    marginTop: 20,
  },
  commentsList: {
    flex: 1,
  },
  commentItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  userName: {
    fontWeight: 'bold',
  },
  commentDate: {
    fontSize: 12,
    color: '#666',
  },
  commentContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  noComments: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
  },
  submitButton: {
    backgroundColor: '#0066cc',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  actionButton: {
    padding: 6,
    marginLeft: 8,
  },
  editContainer: {
    marginTop: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    minHeight: 60,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#28a745',
  },
  editButtonText: {
    color: '#333',
    fontSize: 12,
  },
});

export default TripComments;
