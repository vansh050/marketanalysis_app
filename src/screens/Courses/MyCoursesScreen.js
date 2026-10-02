import React, {useCallback, useEffect, useState} from 'react';
import {useNavigation} from '@react-navigation/native';

import {useConfig} from '../../context/ConfigContext';
import gumletService from '../../FunctionCall/services/GumletService';
import {useComponent} from '../../design/useDesign';
import {designColor} from '../../design/literalTokens';

export default function MyCoursesScreen() {
  const navigation = useNavigation();
  const config = useConfig();
  const Presentation = useComponent('screens.MyCoursesScreen');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async ({pullToRefresh = false} = {}) => {
    if (pullToRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await gumletService.listCollections();
      if (result?.success) {
        setCourses((result.data || []).filter(course => course.kind !== 'webinar'));
        setError('');
      } else {
        setError(result?.message || 'Failed to load courses');
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Error fetching courses');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Presentation
      viewModel={{
        accent: config?.mainColor || config?.themeColor || designColor('16a34a'),
        courses,
        loading,
        refreshing,
        error,
      }}
      actions={{
        onRefresh: () => load({pullToRefresh: true}),
        onRetry: load,
        onOpenCourse: courseId => navigation.navigate('CourseDetail', {courseId}),
      }}
    />
  );
}
